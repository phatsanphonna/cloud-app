"use client"

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BackButton from '@/components/next/BackButton'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'
import { useUser as useGlobalUser } from '@/lib/user'

const GAME_TYPES = [
  { id: 'roll-dice', name: 'Roll Dice', description: 'Guess the six-sided die' },
  { id: 'spin-wheel', name: 'Spin Wheel', description: 'Random winner takes all' },
  { id: 'match-fixing', name: 'Match Fixing', description: 'Host-controlled Q&A' },
  { id: 'vote', name: 'Vote', description: 'Choose the winning option' }
]

interface User {
  id: string
  name: string
  money: number
}

interface GameSession {
  id: string
  roomId: string
  gameType: string
  status: string
  hostId?: string
  totalPrizePool: number
  bets: Array<{
    id: string
    playerId: string
    amount: number
    prediction?: any
  }>
}

export default function BettingPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const roomId = params.roomId as string
  const gameType = searchParams.get('gameType') as string
  
  const [user, setUser] = useState<User | null>(null)
  const [globalUser] = useGlobalUser()
  const [betAmount, setBetAmount] = useState<number>(10)
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  const hasUserBet = gameSession?.bets.some(bet => bet.playerId === user?.id)
  const isMatchFixingHost = gameType === 'match-fixing' && !!gameSession?.hostId && gameSession.hostId === user?.id

  const redirectToGame = useCallback((session: GameSession | null) => {
    if (!session) return
    const targetType = session.gameType || gameType
    let gameUrl = `/game/play?roomId=${roomId}&gameId=${session.id}&gameType=${targetType}`
        
    if (targetType === 'roll-dice') {
      gameUrl = `/game/roll-dice?roomId=${roomId}&gameId=${session.id}`
    } else if (targetType === 'spin-wheel') {
      gameUrl = `/game/spin-wheel?roomId=${roomId}&gameId=${session.id}`
    } else if (targetType === 'match-fixing') {
      gameUrl = `/game/match-fixing?roomId=${roomId}&gameId=${session.id}`
    } else if (targetType === 'vote') {
      gameUrl = `/game/vote?roomId=${roomId}&gameId=${session.id}`
    }
    router.push(gameUrl)
  }, [router, roomId, gameType])

  useEffect(() => {
    if (globalUser) {
      setUser({
        id: globalUser.id,
        name: globalUser.username,
        money: globalUser.money,
      })
      setHydrated(true)
      return
    }

    const userData = localStorage.getItem('user')
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      setHydrated(true)
    } else {
      router.push('/signin')
    }
  }, [globalUser, router])

  useEffect(() => {
    if (!hydrated) return
    if (!gameType || !roomId) {
      router.push(roomId ? `/room/${roomId}` : '/')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) return

    const connectWebSocket = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }

      const websocket = new WebSocket(buildWsUrl(`/betting/ws/${roomId}`), buildWsProtocols(token))
      socketRef.current = websocket

      websocket.onopen = () => {
        console.log('Connected to betting websocket')
        setWs(websocket)
        websocket.send(JSON.stringify({ type: 'get_game_session', gameType }))
      }

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data)

        console.log(data)
        
        if (data.type === 'game_session_update') {
          setGameSession(data.gameSession)
        }
        
        if (data.type === 'bet_placed') {
          setGameSession(prev => prev ? { ...prev, ...data.gameSession } : null)
        }
        
        if (data.type === 'all_bets_placed') {
          setGameSession(data.gameSession)
          redirectToGame(data.gameSession)
        }
      }

      websocket.onerror = (event) => {
        console.error('Betting websocket error', event)
      }

      websocket.onclose = (event) => {
        console.log('Disconnected from betting websocket', event.code, event.reason || '')
        setWs(null)

        if (!event.wasClean) {
          reconnectTimer.current = setTimeout(connectWebSocket, 2000)
        }
      }
    }

    connectWebSocket()

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
      socketRef.current?.close()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, gameType, roomId])


  const handlePlaceBet = async () => {
    if (!user || !gameSession || !ws) return
    if (isMatchFixingHost) {
      alert('Hosts cannot bet in the match-fixing game')
      return
    }
    
    if (betAmount > user.money) {
      alert('Insufficient balance')
      return
    }

    // Determine if a prediction is required
    const requiresPrediction = gameType === 'roll-dice' || gameType === 'vote'
    if (requiresPrediction && !prediction) {
      alert('Please enter your prediction')
      return
    }

    setLoading(true)
    
    try {
      ws.send(JSON.stringify({
        type: 'place_bet',
        gameSessionId: gameSession.id,
        amount: betAmount,
        prediction: prediction
      }))
      
      // Update player balance locally
      const updatedUser = { ...user, money: user.money - betAmount }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
    } catch (error) {
      console.error('Error placing bet:', error)
      alert('Failed to place bet')
    } finally {
      setLoading(false)
    }
  }

  const renderPredictionInput = () => {
    switch (gameType) {
      case 'roll-dice':
        return (
          <div className="space-y-2">
            <Label>Pick a number (1-6)</Label>
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <Button
                  key={num}
                  variant={prediction === num ? "default" : "outline"}
                  onClick={() => setPrediction(num)}
                  className="aspect-square"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        )
      
      case 'spin-wheel':
        return (
          <div className="space-y-2">
            <Label>Spin Wheel</Label>
            <p className="text-sm text-muted-foreground">This mode picks a random winner automatically.</p>
          </div>
        )
      
      case 'match-fixing':
        return (
          <div className="space-y-2">
            <Label>Match Fixing</Label>
            <p className="text-sm text-muted-foreground">
              Wait for the host to set the question in the Match Fixing screen after everyone has bet.
            </p>
            {isMatchFixingHost && (
              <p className="text-xs text-amber-600">
                You are the host of this game, so you cannot bet.
              </p>
            )}
          </div>
        )
      
      case 'vote':
        return (
          <div className="space-y-2">
            <Label>Vote</Label>
            <p className="text-sm text-muted-foreground">Wait for the host to provide the options.</p>
          </div>
        )
      
      default:
        return null
    }
  }

  useEffect(() => {
    if (!gameSession || gameSession.status !== 'playing') {
      return
    }
    redirectToGame(gameSession)
  }, [gameSession, redirectToGame])

  const getCurrentGameType = () => {
    return GAME_TYPES.find(type => type.id === gameType)
  }

  if (!user) return <div>Loading…</div>

  return (
    <div className="min-h-screen p-4 text-black w-full">
      <div className="mx-auto flex w-full flex-col gap-4">
        <div className="flex items-center justify-between">
          <BackButton />
        </div>

        <Card className="w-full max-w-md border shadow-md">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-lg text-slate-900">
              {getCurrentGameType()?.name} - Place your bet
            </CardTitle>
            <p className="text-sm text-slate-500">{getCurrentGameType()?.description}</p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p>Player: <span className="font-semibold text-slate-800">{user.name}</span></p>
              <p>Balance: <span className="font-semibold text-emerald-600">{user.money}</span></p>
            </div>

            {gameSession && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p>Prize pool: <span className="font-semibold text-amber-600">{gameSession.totalPrizePool}</span></p>
                <p>Bets placed: <span className="font-semibold text-slate-800">{gameSession.bets.length}</span></p>
              </div>
            )}

            {!hasUserBet ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-700">Bet amount</Label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    min="1"
                    max={user.money}
                    disabled={isMatchFixingHost}
                  />
                </div>

                {renderPredictionInput()}
                {isMatchFixingHost && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Match Fixing hosts only reveal answers and cannot place bets.
                  </div>
                )}

                <Button
                  onClick={handlePlaceBet}
                  disabled={loading || betAmount <= 0 || betAmount > user.money || isMatchFixingHost}
                  className="w-full text-base text-white"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner className="text-white" />
                      Placing bet...
                    </span>
                  ) : (
                    `Bet ${betAmount}`
                  )}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-emerald-700">
                Bet placed.<br />Waiting for the remaining players…
              </div>
            )}

            {gameSession && gameSession.bets.length > 0 && (
              <div className="space-y-2 text-sm">
                <Label className="text-slate-700">Players who already bet</Label>
                <div className="space-y-2">
                  {gameSession.bets.map(bet => (
                    <div key={bet.id} className="flex justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                      <span>Player {bet.playerId.slice(0, 6)}...</span>
                      <span className="font-semibold">{bet.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
