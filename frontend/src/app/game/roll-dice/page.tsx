"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import BackButton from '@/components/next/BackButton'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'
import Link from 'next/link'

interface Player {
  id: string
  name: string
  prediction: number | null
  betAmount: number
}

interface GameResult {
  diceResult: number
  winners: Player[]
  winAmount: number
}

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']

export default function RollDiceGamePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const roomId = searchParams.get('roomId')
  const gameId = searchParams.get('gameId')

  const [user, setUser] = useState<any>(null)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameStatus, setGameStatus] = useState<'waiting' | 'rolling' | 'finished'>('waiting')
  const [diceValue, setDiceValue] = useState<number | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [totalPrizePool, setTotalPrizePool] = useState<number>(0)
  const [hostId, setHostId] = useState<string | null>(null)

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      router.push('/signin')
    }

    if (!roomId || !gameId) {
      router.push('/')
      return
    }
  }, [router, roomId, gameId])

  useEffect(() => {
    if (!user || !gameId) return

    const token = localStorage.getItem('token')
    if (!token) return

    const websocket = new WebSocket(buildWsUrl(`/game/roll-dice/ws/${gameId}`), buildWsProtocols(token))

    websocket.onopen = () => {
      console.log('Connected to Roll Dice game')
      setWs(websocket)
      // ขอข้อมูลเกม
      websocket.send(JSON.stringify({ type: 'get_game_status' }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received Roll Dice message:', data)

      if (data.type === 'game_status') {
        setPlayers(data.players)
        setTotalPrizePool(data.totalPrizePool)
        setGameStatus(data.gameStatus)
        setHostId(data.hostId || null)

        if (data.gameStatus === 'waiting') {
          setDiceValue(null)
          setGameResult(null)
          setIsRolling(false)
        }
      }

      if (data.type === 'dice_rolling') {
        setIsRolling(true)
        setGameStatus('rolling')

        // Animation แบบจำลอง
        let rollCount = 0
        const rollInterval = setInterval(() => {
          setDiceValue(Math.floor(Math.random() * 6) + 1)
          rollCount++

          if (rollCount >= 20) {
            clearInterval(rollInterval)
            setDiceValue(data.result)
            setIsRolling(false)

            // รอแป๊บเดียวแล้วแสดงผล
            setTimeout(() => {
              setGameResult({
                diceResult: data.result,
                winners: data.winners,
                winAmount: data.winAmount
              })
              setGameStatus('finished')
            }, 1000)
          }
        }, 100)
      }

      if (data.type === 'game_finished') {
        setGameResult({
          diceResult: data.diceResult,
          winners: data.winners,
          winAmount: data.winAmount
        })
        setGameStatus('finished')

        // อัปเดตเงินผู้เล่น
        if (data.winners.some((w: Player) => w.id === user.id)) {
          const updatedUser = { ...user, money: user.money + data.winAmount }
          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      }
    }

    websocket.onclose = () => {
      console.log('Disconnected from Roll Dice game')
      setWs(null)
    }

    return () => {
      websocket.close()
    }
  }, [user, gameId])

  const rollDice = () => {
    if (!ws || gameStatus !== 'waiting') return
    if (hostId && user?.id !== hostId) return

    ws.send(JSON.stringify({ type: 'start_roll' }))
  }

  const playAgain = () => {
    router.push(`/room/${roomId}`)
  }

  const goToRoom = () => {
    router.push(`/room/${roomId}`)
  }

  if (!user || !roomId || !gameId) return <div>กำลังโหลด...</div>

  return (
    <div className="min-h-screen p-4 text-black">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 pt-3">
        <div className="flex items-center justify-between">
          <BackButton />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-wide">🎲 Roll Dice Game</h1>
          <p className="text-slate-500 text-sm">ทอยลูกเต๋าให้ตรง รับเงินกองกลางไปเลย!</p>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="w-full max-w-md border shadow-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-lg text-slate-800">🏆 เงินรางวัลรวม</CardTitle>
              <CardDescription className="text-3xl font-bold text-slate-900">{totalPrizePool} บาท</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className={`text-7xl ${isRolling ? 'animate-spin' : ''}`}>
                  {diceValue !== null ? DICE_FACES[diceValue - 1] : '—'}
                </div>
                <div className="text-base font-semibold text-slate-700">
                  {isRolling ? 'กำลังทอย...' : `ผลลัพธ์ล่าสุด: ${diceValue ?? '-'}`}
                </div>
              </div>

              {gameStatus === 'waiting' && (
                <div className="flex flex-col items-center gap-2 w-full">
                  <Button
                    onClick={rollDice}
                    className="w-full bg-rose-600 hover:bg-rose-600/90 text-white text-base"
                    disabled={!ws || (hostId !== null && user?.id !== hostId)}
                  >
                    🎲 ทอยลูกเต๋า
                  </Button>
                  {hostId && user?.id !== hostId && (
                    <p className="text-sm text-rose-600">โฮสต์เป็นคนทอยลูกเต๋าเท่านั้น</p>
                  )}
                </div>
              )}

              {isRolling && (
                <div className="rounded-full border border-amber-200 px-4 py-1 text-sm text-amber-600">
                  ⚡ กำลังทอยลูกเต๋า...
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="w-full max-w-md border shadow-md">
            <CardHeader>
              <CardTitle className="text-base text-slate-800">ผู้เล่นทั้งหมด</CardTitle>
              <CardDescription className="text-xs text-slate-500">มี {players.length} คนร่วมเดิมพัน</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {player.id === user.id ? 'คุณ' : `ผู้เล่น ${index + 1}`}
                      {player.id === hostId && (
                        <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">HOST</span>
                      )}
                    </div>
                    <span className="text-slate-500">แทง {player.betAmount} บาท</span>
                  </div>
                  <div className="text-xs text-slate-400">ทายเลข {player.prediction ?? '—'}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {gameResult && (
          <Card className="w-full max-w-md border shadow-md">
            <CardHeader className="text-center space-y-1">
              <CardTitle className="text-lg text-slate-800">🎉 ผลการแข่งขัน</CardTitle>
              <CardDescription className="text-sm text-slate-500">ลูกเต๋าออก {gameResult.diceResult}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="text-6xl">{DICE_FACES[gameResult.diceResult - 1]}</div>

              {gameResult.winners.length === 0 ? (
                <p className="rounded-lg bg-rose-100 px-4 py-3 text-rose-600 text-sm">
                  ไม่มีใครทายถูกครั้งนี้
                </p>
              ) : (
                <div className="rounded-lg bg-emerald-100 px-4 py-3 text-emerald-700 text-sm">
                  ผู้ชนะ: {gameResult.winners.map(w => (w.id === user.id ? 'คุณ' : w.name)).join(', ')}<br />
                  รับไปคนละ <span className="font-semibold">{gameResult.winAmount} บาท</span>
                </div>
              )}

              {gameStatus === 'finished' && (
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/" className={buttonVariants()}>
                    กลับหน้าหลัก
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
