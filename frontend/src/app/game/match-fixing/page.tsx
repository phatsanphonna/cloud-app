"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BackButton from '@/components/next/BackButton'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
}

interface Player {
  id: string
  name: string
  betAmount: number
  answers: number[]
}

interface GameResult {
  questions: Question[]
  winners: Player[]
  winAmount: number
}

export default function MatchFixingGamePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const roomId = searchParams.get('roomId')
  const gameId = searchParams.get('gameId')
  
  const [user, setUser] = useState<any>(null)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameStatus, setGameStatus] = useState<'setup' | 'waiting' | 'answering' | 'finished'>('setup')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [playerAnswers, setPlayerAnswers] = useState<number[]>([])
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [totalPrizePool, setTotalPrizePool] = useState<number>(0)

  // Host setup states
  const [newQuestion, setNewQuestion] = useState('')
  const [newOptions, setNewOptions] = useState(['', '', '', ''])
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(0)

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

    const websocket = new WebSocket(buildWsUrl(`/game/match-fixing/${gameId}`), buildWsProtocols(token))
    
    websocket.onopen = () => {
      console.log('Connected to Match Fixing game')
      setWs(websocket)
      websocket.send(JSON.stringify({ type: 'get_game_status' }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received Match Fixing message:', data)
      
      if (data.type === 'game_status') {
        setPlayers(data.players)
        setTotalPrizePool(data.totalPrizePool)
        setGameStatus(data.gameStatus)
        setIsHost(data.hostId === user.id)
        if (data.questions) setQuestions(data.questions)
      }
      
      if (data.type === 'question_added') {
        setQuestions(data.questions)
        setNewQuestion('')
        setNewOptions(['', '', '', ''])
        setCorrectAnswerIndex(0)
      }
      
      if (data.type === 'game_started') {
        setGameStatus('answering')
        setCurrentQuestionIndex(0)
        setPlayerAnswers([])
      }
      
      if (data.type === 'next_question') {
        setCurrentQuestionIndex(data.questionIndex)
        setPlayerAnswers(prev => [...prev, -1]) // placeholder for current question
      }
      
      if (data.type === 'game_finished') {
        setGameResult({
          questions: data.questions,
          winners: data.winners,
          winAmount: data.winAmount
        })
        setGameStatus('finished')
        
        // อัปเดตเงินผู้เล่นถ้าเป็นผู้ชนะ
        if (data.winners.some((w: Player) => w.id === user.id)) {
          const updatedUser = { ...user, money: user.money + data.winAmount }
          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      }
    }

    websocket.onclose = () => {
      console.log('Disconnected from Match Fixing game')
      setWs(null)
    }

    return () => {
      websocket.close()
    }
  }, [user, gameId])

  const addQuestion = () => {
    if (!ws || !newQuestion.trim() || newOptions.some(opt => !opt.trim())) return
    
    ws.send(JSON.stringify({
      type: 'add_question',
      question: newQuestion,
      options: newOptions,
      correctAnswer: correctAnswerIndex
    }))
  }

  const startGame = () => {
    if (!ws || questions.length === 0) return
    
    ws.send(JSON.stringify({ type: 'start_game' }))
  }

  const submitAnswer = (answerIndex: number) => {
    if (!ws || gameStatus !== 'answering') return
    
    const updatedAnswers = [...playerAnswers]
    updatedAnswers[currentQuestionIndex] = answerIndex
    setPlayerAnswers(updatedAnswers)
    
    ws.send(JSON.stringify({
      type: 'submit_answer',
      questionIndex: currentQuestionIndex,
      answerIndex
    }))
  }

  const nextQuestion = () => {
    if (!ws || !isHost) return
    
    ws.send(JSON.stringify({ type: 'next_question' }))
  }

  const finishGame = () => {
    if (!ws || !isHost) return
    
    ws.send(JSON.stringify({ type: 'finish_game' }))
  }

  const playAgain = () => {
    router.push(`/room/${roomId}`)
  }

  const goToRoom = () => {
    router.push(`/room/${roomId}`)
  }

  if (!user || !roomId || !gameId) return <div>กำลังโหลด...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 p-4">
      <BackButton />
      
      <div className="max-w-4xl mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            🧠 Match Fixing Game
          </h1>
          <p className="text-white/80">
            {isHost ? 'ตั้งคำถามและคำตอบที่ถูกต้อง' : 'ตอบคำถามให้ถูกทุกข้อเพื่อชนะ'}
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

        {/* Host Setup Phase */}
        {isHost && gameStatus === 'setup' && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                ⚙️ ตั้งคำถาม ({questions.length} ข้อ)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white">คำถาม</Label>
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="พิมพ์คำถาม..."
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newOptions.map((option, index) => (
                  <div key={index}>
                    <Label className="text-white">ตัวเลือก {index + 1}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const updated = [...newOptions]
                          updated[index] = e.target.value
                          setNewOptions(updated)
                        }}
                        placeholder={`ตัวเลือก ${index + 1}`}
                        className="bg-white/10 border-white/20 text-white"
                      />
                      <Button
                        variant={correctAnswerIndex === index ? "default" : "outline"}
                        onClick={() => setCorrectAnswerIndex(index)}
                        className="min-w-20"
                      >
                        {correctAnswerIndex === index ? '✓' : 'ถูก?'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <Button 
                  onClick={addQuestion}
                  disabled={!newQuestion.trim() || newOptions.some(opt => !opt.trim())}
                  className="bg-green-600 hover:bg-green-700"
                >
                  ➕ เพิ่มคำถาม
                </Button>
                {questions.length > 0 && (
                  <Button 
                    onClick={startGame}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    🚀 เริ่มเกม ({questions.length} ข้อ)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Question List */}
        {questions.length > 0 && gameStatus === 'setup' && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                📝 คำถามทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {questions.map((q, index) => (
                  <div key={q.id} className="bg-white/5 p-4 rounded-lg">
                    <h4 className="text-white font-semibold mb-2">
                      {index + 1}. {q.question}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((option, optIndex) => (
                        <div 
                          key={optIndex}
                          className={`p-2 rounded text-sm ${
                            optIndex === q.correctAnswer 
                              ? 'bg-green-500/30 text-green-300' 
                              : 'bg-white/10 text-white/80'
                          }`}
                        >
                          {optIndex + 1}. {option}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wait for Host */}
        {!isHost && gameStatus === 'setup' && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardContent className="p-8 text-center">
              <div className="text-white">
                <h3 className="text-xl font-semibold mb-4">⏳ รอ Host ตั้งคำถาม</h3>
                <p className="text-white/70">Host กำลังเตรียมคำถามอยู่...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Answering Phase */}
        {gameStatus === 'answering' && currentQuestionIndex < questions.length && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                คำถามที่ {currentQuestionIndex + 1} / {questions.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-6">
                  {questions[currentQuestionIndex]?.question}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {questions[currentQuestionIndex]?.options.map((option, index) => (
                    <Button
                      key={index}
                      onClick={() => submitAnswer(index)}
                      disabled={playerAnswers[currentQuestionIndex] !== undefined}
                      variant={playerAnswers[currentQuestionIndex] === index ? "default" : "outline"}
                      className="p-4 h-auto text-wrap"
                    >
                      <div>
                        <div className="font-bold">{index + 1}</div>
                        <div>{option}</div>
                      </div>
                    </Button>
                  ))}
                </div>
                
                {playerAnswers[currentQuestionIndex] !== undefined && (
                  <div className="mt-4 text-green-400">
                    ✅ คุณตอบแล้ว: {playerAnswers[currentQuestionIndex] + 1}
                  </div>
                )}
              </div>
              
              {isHost && (
                <div className="text-center">
                  <Button 
                    onClick={nextQuestion}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    ➡️ คำถามต่อไป
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                {gameResult.winners.length > 0 ? (
                  <div>
                    <h3 className="text-xl font-bold text-green-400 mb-4">
                      🏆 ผู้ชนะ (ตอบถูกทุกข้อ)
                    </h3>
                    <div className="space-y-2">
                      {gameResult.winners.map((winner, index) => (
                        <div key={winner.id} className="bg-green-500/20 p-3 rounded-lg">
                          <div className="text-white font-semibold">
                            {winner.id === user.id ? 'คุณ' : `ผู้เล่น ${index + 1}`}
                          </div>
                          <div className="text-green-400">
                            ได้เงิน: {gameResult.winAmount} บาท
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-500/20 p-4 rounded-lg">
                    <div className="text-red-400 font-semibold">
                      😢 ไม่มีผู้ชนะ
                    </div>
                    <div className="text-white/70">
                      ไม่มีใครตอบถูกทุกข้อ
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
                <div key={player.id} className="bg-white/5 p-4 rounded-lg">
                  <div className="flex justify-between items-center text-white">
                    <div>
                      <div className="font-semibold">
                        {player.id === user.id ? 'คุณ' : `ผู้เล่น ${index + 1}`}
                        {isHost && player.id === user.id && ' (Host)'}
                      </div>
                      <div className="text-sm text-white/70">
                        แทง: {player.betAmount} บาท
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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
