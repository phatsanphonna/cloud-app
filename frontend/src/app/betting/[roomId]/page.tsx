"use client"

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BackButton from '@/components/next/BackButton'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'
import { useUser as useGlobalUser } from '@/lib/user'

const GAME_TYPES = [
  { id: 'roll-dice', name: 'Roll Dice', description: 'ทายลูกเต๋า 6 หน้า' },
  { id: 'spin-wheel', name: 'Spin Wheel', description: 'สุ่มผู้โชคดี' },
  { id: 'match-fixing', name: 'Match Fixing', description: 'ตอบคำถาม' },
  { id: 'vote', name: 'Vote', description: 'โหวตตัวเลือก' }
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
    
    if (betAmount > user.money) {
      alert('เงินไม่เพียงพอ!')
      return
    }

    // ตรวจสอบว่าต้องมีการทายหรือไม่
    if ((gameType === 'roll-dice' && !prediction) || 
        (gameType === 'match-fixing' && !prediction) || 
        (gameType === 'vote' && !prediction)) {
      alert('กรุณาใส่การทายผล!')
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
      
      // อัปเดตเงินผู้เล่น
      const updatedUser = { ...user, money: user.money - betAmount }
      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
    } catch (error) {
      console.error('Error placing bet:', error)
      alert('เกิดข้อผิดพลาดในการแทง!')
    } finally {
      setLoading(false)
    }
  }

  const renderPredictionInput = () => {
    switch (gameType) {
      case 'roll-dice':
        return (
          <div className="space-y-2">
            <Label>ทายลูกเต๋า (1-6)</Label>
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
            <Label>Spin Wheel (ไม่ต้องทาย)</Label>
            <p className="text-sm text-muted-foreground">เกมนี้จะสุ่มผู้ชนะ ไม่ต้องทายผล</p>
          </div>
        )
      
      case 'match-fixing':
        return (
          <div className="space-y-2">
            <Label>Match Fixing</Label>
            <p className="text-sm text-muted-foreground">รอ Host ตั้งคำถาม</p>
          </div>
        )
      
      case 'vote':
        return (
          <div className="space-y-2">
            <Label>Vote</Label>
            <p className="text-sm text-muted-foreground">รอ Host ตั้งตัวเลือก</p>
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

  const hasUserBet = gameSession?.bets.some(bet => bet.playerId === user?.id)

  if (!user) return <div>กำลังโหลด...</div>

  return (
    <div className="min-h-screenp-4 text-black">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center justify-between">
          <BackButton />
        </div>

        <Card className="w-full max-w-md border shadow-md">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-lg text-slate-900">
              {getCurrentGameType()?.name} - การแทงเงิน
            </CardTitle>
            <p className="text-sm text-slate-500">{getCurrentGameType()?.description}</p>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p>ผู้เล่น: <span className="font-semibold text-slate-800">{user.name}</span></p>
              <p>เงินคงเหลือ: <span className="font-semibold text-emerald-600">{user.money} บาท</span></p>
            </div>

            {gameSession && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p>เงินรางวัลรวม: <span className="font-semibold text-amber-600">{gameSession.totalPrizePool} บาท</span></p>
                <p>จำนวนผู้แทง: <span className="font-semibold text-slate-800">{gameSession.bets.length} คน</span></p>
              </div>
            )}

            {!hasUserBet ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-700">จำนวนเงินที่แทง</Label>
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    min="1"
                    max={user.money}
                  />
                </div>

                {renderPredictionInput()}

                <Button
                  onClick={handlePlaceBet}
                  disabled={loading || betAmount <= 0 || betAmount > user.money}
                  className="w-full text-base text-white"
                >
                  {loading ? 'กำลังแทง...' : `แทงเงิน ${betAmount} บาท`}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-emerald-700">
                ✅ แทงเงินเรียบร้อยแล้ว<br />รอผู้เล่นคนอื่นแทงเงิน...
              </div>
            )}

            {gameSession && gameSession.bets.length > 0 && (
              <div className="space-y-2 text-sm">
                <Label className="text-slate-700">ผู้เล่นที่แทงแล้ว</Label>
                <div className="space-y-2">
                  {gameSession.bets.map(bet => (
                    <div key={bet.id} className="flex justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                      <span>ผู้เล่น {bet.playerId.slice(0, 6)}...</span>
                      <span className="font-semibold">{bet.amount} บาท</span>
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
