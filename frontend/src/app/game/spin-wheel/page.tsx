"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import BackButton from '@/components/next/BackButton'
import SpinWheel from '@/components/next/SpinWheel'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'

interface Player {
  id: string
  name: string
  betAmount: number
}

interface GameResult {
  winnerId: string
  winnerName: string
  totalWinAmount: number
}

export default function SpinWheelGamePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const roomId = searchParams.get('roomId')
  const gameId = searchParams.get('gameId')
  
  const [user, setUser] = useState<any>(null)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameStatus, setGameStatus] = useState<'waiting' | 'spinning' | 'finished'>('waiting')
  const [selectedPlayer, setSelectedPlayer] = useState<string>('')
  const [isWheelSpinning, setIsWheelSpinning] = useState(false)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [totalPrizePool, setTotalPrizePool] = useState<number>(0)
  const [wheelTrigger, setWheelTrigger] = useState<{ id: string; nonce: number } | null>(null)

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD']
  const wheelItems = players.map((player, index) => ({
    id: player.id,
    label: player.id === user?.id ? 'คุณ' : `ผู้เล่น ${index + 1}`,
    color: colors[index % colors.length],
  }))

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

    const websocket = new WebSocket(buildWsUrl(`/game/spin-wheel/ws/${gameId}`), buildWsProtocols(token))
    
    websocket.onopen = () => {
      console.log('Connected to Spin Wheel game')
      setWs(websocket)
      // ขอข้อมูลเกม
      websocket.send(JSON.stringify({ type: 'get_game_status' }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received Spin Wheel message:', data)
      
      if (data.type === 'game_status') {
        setPlayers(data.players)
        setTotalPrizePool(data.totalPrizePool)
        setGameStatus(data.gameStatus)
      }
      
      if (data.type === 'wheel_spinning') {
        setGameStatus('spinning')
        setIsWheelSpinning(true)
        setSelectedPlayer(data.winnerId)
        setWheelTrigger({ id: data.winnerId, nonce: Date.now() })
      }
      
      if (data.type === 'game_finished') {
        setGameResult({
          winnerId: data.winnerId,
          winnerName: data.winnerName,
          totalWinAmount: data.totalWinAmount
        })
        setGameStatus('finished')
        setIsWheelSpinning(false)
        
        // อัปเดตเงินผู้เล่นถ้าเป็นผู้ชนะ
        if (data.winnerId === user.id) {
          const updatedUser = { ...user, money: user.money + data.totalWinAmount }
          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      }
    }

    websocket.onclose = () => {
      console.log('Disconnected from Spin Wheel game')
      setWs(null)
    }

    return () => {
      websocket.close()
    }
  }, [user, gameId])

  const spinWheel = () => {
    if (!ws || gameStatus !== 'waiting' || isWheelSpinning) return
    
    ws.send(JSON.stringify({ type: 'start_spin' }))
  }

  const playAgain = () => {
    router.push(`/room/${roomId}`)
  }

  const goToRoom = () => {
    router.push(`/room/${roomId}`)
  }

  if (!user || !roomId || !gameId) return <div>กำลังโหลด...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-cyan-900 to-teal-900 p-4">
      <BackButton />
      
      <div className="max-w-4xl mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎯 Spin Wheel Game
          </h1>
          <p className="text-white/80">
            หมุนล้อโชค! ใครได้จะได้เงินทั้งหมด
          </p>
        </div>

        {/* Prize Pool */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">
              🏆 เงินรางวัลรวม
            </h2>
            <div className="text-4xl font-bold text-white">
              {totalPrizePool} บาท
            </div>
          </CardContent>
        </Card>

        {/* Spin Wheel */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardContent className="p-8 text-center flex flex-col items-center gap-6">
            <SpinWheel
              items={wheelItems}
              trigger={wheelTrigger}
              showButton={false}
              onFinished={(item) => {
                setSelectedPlayer(item.id as string)
                setIsWheelSpinning(false)
              }}
            />
            
            {gameStatus === 'waiting' && (
              <Button 
                onClick={spinWheel}
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-lg px-8 py-3"
                disabled={!ws || players.length === 0 || isWheelSpinning}
              >
                🎯 หมุนล้อ
              </Button>
            )}
            
            {isWheelSpinning && (
              <div className="text-yellow-400 text-lg">
                🌀 กำลังหมุนล้อ...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Players List */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-xl text-center">
              ผู้เข้าร่วมการแข่งขัน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`p-4 rounded-lg border-2 ${
                    selectedPlayer === player.id ? 'bg-yellow-500/20 border-yellow-400' : 'bg-white/5 border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      ></div>
                      <div>
                        <div className="font-semibold">
                          {player.id === user.id ? 'คุณ' : `ผู้เล่น ${index + 1}`}
                        </div>
                        <div className="text-sm text-white/70">
                          แทง: {player.betAmount} บาท
                        </div>
                      </div>
                    </div>
                    {selectedPlayer === player.id && (
                      <div className="text-yellow-400 font-bold">
                        👑 ผู้ชนะ
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Game Result */}
        {gameResult && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl text-center">
                🎉 ผลการแข่งขัน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-2xl font-bold text-green-400 mb-4">
                  ผู้ชนะ: {gameResult.winnerId === user.id ? 'คุณ' : gameResult.winnerName}
                </h3>
                <div className="text-xl text-white mb-4">
                  รางวัล: <span className="text-yellow-400 font-bold">{gameResult.totalWinAmount} บาท</span>
                </div>
                
                {gameResult.winnerId === user.id ? (
                  <div className="bg-green-500/20 p-4 rounded-lg">
                    <div className="text-green-400 font-semibold text-lg">
                      🎊 ยินดีด้วย! คุณชนะแล้ว!
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-500/20 p-4 rounded-lg">
                    <div className="text-blue-400 font-semibold">
                      😊 โชคดีกว่านี้ครั้งหน้า!
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={playAgain}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  🎮 เล่นเกมอื่น
                </Button>
                <Button 
                  onClick={goToRoom}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  🏠 กลับห้อง
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Money Display */}
        <div className="text-center">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 inline-block">
            <CardContent className="p-4">
              <div className="text-white">
                <p className="text-sm">
                  💰 เงินของคุณ: <span className="font-semibold text-green-400">{user.money} บาท</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
