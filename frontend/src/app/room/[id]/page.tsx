"use client"

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import BackButton from '@/components/next/BackButton'
import { buildApiUrl, buildWsProtocols, buildWsUrl } from '@/lib/config'

const GAME_TYPE_LABELS: Record<string, string> = {
  'roll-dice': 'Roll Dice',
  'spin-wheel': 'Spin Wheel',
  'match-fixing': 'Match Fixing',
  'vote': 'Vote',
}

interface Player {
  id: string
  name: string
}

interface Room {
  id: string
  roomCode?: string
  hostId: string
  players: string[]
  minPlayer: number
  status: string
  gameType?: string
}

interface WSMessage {
  type: string
  room?: Room
  countdown?: number
  message?: string
  error?: string
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.id as string
  
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [countdown, setCountdown] = useState<number | null>(null)
  const [message, setMessage] = useState<string>("")
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const gameTypeRef = useRef<string | undefined>(undefined)

  const buildGameUrl = (type?: string | null) => {
    const fallback = 'roll-dice'
    const target = type && typeof type === 'string' ? type : fallback
    return `/betting/${roomId}?gameType=${target}`
  }

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('user')
    console.log('User data from localStorage:', userData)
    if (userData) {
      const parsedUser = JSON.parse(userData)
      console.log('Parsed user:', parsedUser)
      console.log('Setting user to:', { id: parsedUser.id, name: parsedUser.username })
      setUser({ id: parsedUser.id, name: parsedUser.username })
    }
    
    // Check if game has started recently
    const gameStartedData = localStorage.getItem('gameStarted')
    if (gameStartedData) {
      try {
        const gameInfo = JSON.parse(gameStartedData)
        const timeDiff = Date.now() - gameInfo.timestamp
        
        // If game started less than 60 seconds ago and it's for this room
        if (timeDiff < 60000 && gameInfo.roomId === roomId) {
          console.log('Recent game start detected, redirecting to betting page...')
          console.log('Game info:', gameInfo)
          router.push(buildGameUrl(gameInfo.gameType))
          return
        } else if (gameInfo.roomId === roomId) {
          // Clean up old game start data for this room
          localStorage.removeItem('gameStarted')
        }
      } catch (error) {
        console.error('Error parsing gameStarted data:', error)
        localStorage.removeItem('gameStarted')
      }
    }
  }, [roomId, router])

  useEffect(() => {
    if (!roomId || !user) {
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      window.location.href = '/signin'
      return
    }

    const protocols = buildWsProtocols(token)
    let websocket: WebSocket | null = null
    let reconnectTimer: NodeJS.Timeout | null = null

    const statusCheckInterval = setInterval(async () => {
      try {
        const response = await fetch(buildApiUrl(`/room/${roomId}`), {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        if (response.ok) {
          const roomData = await response.json()
          if (roomData.status === 'starting' || roomData.status === 'in_progress') {
            const detectedType = roomData.gameType || gameTypeRef.current || 'roll-dice'
            localStorage.setItem('gameStarted', JSON.stringify({
              roomId,
              timestamp: Date.now(),
              userId: user.id,
              gameType: detectedType
            }))
            router.push(buildGameUrl(detectedType))
            clearInterval(statusCheckInterval)
          }
        }
      } catch (error) {
        console.log('Fallback status check failed:', error)
      }
    }, 3000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('Page hidden, keeping WebSocket alive')
      } else {
        console.log('Page visible again')
      }
    }

    const createWebSocket = () => {
      const socket = new WebSocket(buildWsUrl(`/room/${roomId}`), protocols)

      socket.onopen = () => {
        console.log('Connected to room websocket')
        setWs(socket)
      }

      socket.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data)

          if (data.type === 'room_update' && data.room) {
            setRoom(data.room)
            setIsHost(data.room.hostId === user.id)
            setPlayers(data.room.players.map(playerId => ({ id: playerId, name: `Player ${playerId.slice(0, 6)}` })))
            gameTypeRef.current = data.room.gameType
          }
          
          if (data.type === 'countdown' && data.countdown !== undefined) {
            setCountdown(data.countdown)
          }
          
          if (data.type === 'game_start') {
            setCountdown(null)
            const targetType = gameTypeRef.current || 'roll-dice'
            localStorage.setItem('gameStarted', JSON.stringify({
              roomId,
              timestamp: Date.now(),
              userId: user.id,
              gameType: targetType
            }))
            router.push(buildGameUrl(targetType))
          }
          
          if (data.message) {
            setMessage(data.message)
            setTimeout(() => setMessage(""), 3000)
          }
          
          if (data.error) {
            console.error('WebSocket error:', data.error)
            setMessage(data.error)
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      socket.onclose = (event) => {
        console.log('Disconnected from room websocket')
        setWs(null)

        if (!event.wasClean && event.code !== 1000) {
          reconnectTimer = setTimeout(() => {
            websocket = createWebSocket()
          }, 2000)
        }
      }

      socket.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      return socket
    }

    websocket = createWebSocket()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      clearInterval(statusCheckInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      websocket?.close()
    }
  }, [roomId, user, router])

  const handleStartGame = () => {
    if (ws && isHost) {
      ws.send(JSON.stringify({ start: true }))
    }
  }

  const handleSetMinPlayer = (minPlayer: number) => {
    if (ws && isHost) {
      console.log('Setting min player to:', minPlayer)
      ws.send(JSON.stringify({ minPlayer }))
    }
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Connecting to room...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-4">
        <BackButton />
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Room {room.roomCode || room.id.slice(0, 8)}</CardTitle>
            <Badge variant={room.status === 'waiting' ? 'secondary' : 'default'}>
              {room.status}
            </Badge>
          </div>
          {room.roomCode && (
            <p className="text-sm text-muted-foreground">Code: <span className="font-mono font-bold">{room.roomCode}</span></p>
          )}
          {room.gameType && (
            <p className="text-sm text-muted-foreground">
              Game: <span className="font-semibold">{GAME_TYPE_LABELS[room.gameType] ?? room.gameType}</span>
            </p>
          )}
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Countdown */}
          {countdown !== null && (
            <div className="text-center p-6 bg-primary/10 rounded-lg">
              <h2 className="text-3xl font-bold mb-2">{countdown}</h2>
              <p className="text-muted-foreground">Game starting in...</p>
            </div>
          )}
          
          {/* Room Settings */}
          <div className="flex items-center justify-between">
            <span className="font-medium">Minimum Players:</span>
            <div className="flex gap-2">
              {isHost ? (
                [2, 3, 4, 5].map((num) => (
                  <Button
                    key={num}
                    size="sm"
                    variant={room.minPlayer === num ? 'default' : 'outline'}
                    onClick={() => handleSetMinPlayer(num)}
                  >
                    {num}
                  </Button>
                ))
              ) : (
                <Badge>{room.minPlayer}</Badge>
              )}
            </div>
          </div>
          
          {/* Players */}
          <div>
            <h3 className="font-medium mb-3">
              Players ({players.length}/{room.minPlayer})
            </h3>
            <div className="grid gap-3">
              {players.map((player) => (
                <div key={player.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Avatar>
                    <AvatarFallback>
                      {player.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{player.name}</p>
                    {player.id === room.hostId && (
                      <Badge variant="outline" className="text-xs">Host</Badge>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: Math.max(0, room.minPlayer - players.length) }).map((_, index) => (
                <div key={`empty-${index}`} className="flex items-center gap-3 p-3 border rounded-lg opacity-50">
                  <Avatar>
                    <AvatarFallback>?</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-muted-foreground">Waiting for player...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Start Game Button */}
          {isHost && room.status === 'waiting' && (
            <Button 
              onClick={handleStartGame}
              disabled={players.length < room.minPlayer}
              className="w-full"
            >
              {players.length >= room.minPlayer 
                ? 'Start Game' 
                : `Need ${room.minPlayer - players.length} more player(s)`
              }
            </Button>
          )}
          
          {!isHost && room.status === 'waiting' && (
            <p className="text-center text-muted-foreground">
              Waiting for host to start the game...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
