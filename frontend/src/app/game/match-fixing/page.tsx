"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'
import { AddChoicesPanel } from '@/components/match-fixing/AddChoicesPanel'
import { GameShell } from '@/components/game/GameShell'

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
  const roomTitle = (searchParams.get('roomTitle') ?? searchParams.get('title') ?? '').trim()
  
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
  const [newOptions, setNewOptions] = useState<string[]>(['', ''])
  const [selectedResult, setSelectedResult] = useState<number>(-1)

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

    const websocket = new WebSocket(buildWsUrl(`/game/match-fixing/ws/${gameId}`), buildWsProtocols(token))
    
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
        if (data.questions) {
          setQuestions(data.questions)
          const firstQuestion = data.questions[0]
          if (typeof firstQuestion?.correctAnswer === 'number' && firstQuestion.correctAnswer >= 0) {
            setSelectedResult(firstQuestion.correctAnswer)
          } else {
            setSelectedResult(-1)
          }
        }
      }
      
      if (data.type === 'question_added') {
        setQuestions(data.questions)
        setNewOptions(['', ''])
        setSelectedResult(-1)
      }
      
      if (data.type === 'game_started') {
        setGameStatus('answering')
        setCurrentQuestionIndex(0)
        setPlayerAnswers([])
        setSelectedResult(-1)
      }
      
      if (data.type === 'next_question') {
        setCurrentQuestionIndex(data.questionIndex)
        setPlayerAnswers(prev => {
          const updated = [...prev]
          updated[data.questionIndex] = -1
          return updated
        })
      }
      
      if (data.type === 'game_finished') {
        setGameResult({
          questions: data.questions,
          winners: data.winners,
          winAmount: data.winAmount
        })
        setGameStatus('finished')
        if (data.questions?.[0]) {
          setSelectedResult(data.questions[0].correctAnswer ?? -1)
        }
        
        // Update winner balance locally to reflect payout
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
    if (!ws || newOptions.some(opt => !opt.trim()) || newOptions.length < 2) return
    
    const questionPayload = {
      type: 'add_question',
      question: roomTitle ? roomTitle : roomId ? `Room ${roomId} question` : 'Host question',
      options: newOptions,
    }

    // Optimistic update so host sees the change immediately
    const tempQuestion: Question = {
      id: Date.now().toString(),
      question: questionPayload.question,
      options: [...newOptions],
      correctAnswer: -1,
    }
    setQuestions([tempQuestion])
    setSelectedResult(-1)
    setNewOptions(['', ''])

    ws.send(JSON.stringify(questionPayload))
  }

  const startGame = () => {
    if (!ws || questions.length === 0) return
    
    ws.send(JSON.stringify({ type: 'start_game' }))
    setGameStatus('answering')
    setCurrentQuestionIndex(0)
    setPlayerAnswers([])
    setSelectedResult(-1)
  }

  const submitAnswer = (answerIndex: number) => {
    if (!ws || gameStatus !== 'answering' || isHost) return
    
    const updatedAnswers = [...playerAnswers]
    updatedAnswers[currentQuestionIndex] = answerIndex
    setPlayerAnswers(updatedAnswers)
    
    ws.send(JSON.stringify({
      type: 'submit_answer',
      questionIndex: currentQuestionIndex,
      answerIndex
    }))
  }

  const finishGame = () => {
    if (!ws || !isHost || questions.length === 0) return
    if (selectedResult < 0) {
      alert('Please select the real answer before finishing the game')
      return
    }

    ws.send(JSON.stringify({ type: 'finish_game', answerIndex: selectedResult }))
  }

  const playAgain = () => {
    router.push(`/room/${roomId}`)
  }

  const goToRoom = () => {
    router.push(`/room/${roomId}`)
  }

  if (!user || !roomId || !gameId) return <div>Loading…</div>

  const statusCopy: Record<'setup' | 'waiting' | 'answering' | 'finished', string> = {
    setup: 'Preparing questions',
    waiting: 'Waiting to start',
    answering: 'Collecting answers',
    finished: 'Game finished'
  }

  const currentQuestion = questions[currentQuestionIndex]
  const answeredIndex = playerAnswers[currentQuestionIndex]
  const hasAnswered = typeof answeredIndex === 'number' && answeredIndex >= 0
  const renderSetupContent = () => {
    if (!isHost) {
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          <p className="font-semibold text-slate-700">Waiting for the host to add a question</p>
          <p className="mt-1">The host is preparing a question for everyone</p>
        </div>
      )
    }

    return (
      <div className="space-y-5">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <AddChoicesPanel
            choices={newOptions}
            onChangeChoices={setNewOptions}
            onSubmit={addQuestion}
            onStartGame={startGame}
            canStart={questions.length > 0}
            questionLabel={roomTitle || (roomId ? `Room ${roomId} question` : 'Host question')}
            disabled={questions.length > 0}
          />
        </div>
      </div>
    )
  }

  const renderWaitingContent = () => (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
      <p className="font-semibold text-slate-700">Setting things up</p>
      <p className="mt-1">Players are joining the room or waiting for the host to start</p>
    </div>
  )

  const renderAnsweringContent = () => (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Question {currentQuestionIndex + 1} / {questions.length}</p>
        <h2 className="text-2xl font-semibold text-slate-900">{currentQuestion?.question}</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {currentQuestion?.options.map((option, index) => {
          const isActive = hasAnswered && answeredIndex === index
          return (
            <Button
              key={index}
              type="button"
              onClick={() => submitAnswer(index)}
              disabled={hasAnswered || isHost}
              variant={isActive ? 'default' : 'outline'}
              className="h-auto p-4 text-left"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">Option {index + 1}</p>
                <p className="text-base font-medium text-slate-900">{option}</p>
              </div>
            </Button>
          )
        })}
      </div>

      {hasAnswered && !isHost && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Answer submitted: option {answeredIndex + 1}
        </div>
      )}
    </div>
  )

  const renderFinishedContent = () => (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">
      Game finished! Scroll down to see the results.
    </div>
  )

  const renderMainSection = () => {
    if (gameStatus === 'answering' && currentQuestion) return renderAnsweringContent()
    if (gameStatus === 'setup') return renderSetupContent()
    if (gameStatus === 'waiting') return renderWaitingContent()
    if (gameStatus === 'finished') return renderFinishedContent()

    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
        Preparing game data…
      </div>
    )
  }

  const renderQuestionPreviewCard = () => {
    if (!(questions.length > 0 && gameStatus === 'setup')) return null

    return (
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-slate-800">All questions</CardTitle>
          <CardDescription className="text-xs text-slate-500">Host is preparing {questions.length} question(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q, index) => (
            <div key={q.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">{index + 1}. {q.question}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {q.options.map((option, optIndex) => (
                  <div
                    key={optIndex}
                    className={`rounded border px-2 py-1 text-sm ${optIndex === q.correctAnswer ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}
                  >
                    {optIndex + 1}. {option}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const renderHostControlsCard = () => {
    if (!isHost || questions.length === 0) return null

    const canResolve = gameStatus === 'answering' && currentQuestion
    const hasResolved = gameStatus === 'finished' && selectedResult >= 0

    return (
      <Card className="border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base text-slate-800">Host Controls</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {canResolve ? 'Select the real answer before announcing winners' : 'Waiting for players to answer or for the game to finish'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {canResolve && currentQuestion ? (
            <>
              <p className="text-sm text-slate-600">
                When you know the real outcome, pick the correct option to pay the winners
              </p>
              <div className="grid grid-cols-1 gap-2">
                {currentQuestion.options.map((option, index) => {
                  const isSelected = selectedResult === index
                  return (
                    <Button
                      key={index}
                      type="button"
                      onClick={() => setSelectedResult(index)}
                      variant={isSelected ? 'default' : 'outline'}
                      className="h-auto justify-start p-3 text-left"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Option {index + 1}</p>
                        <p className="text-sm font-medium text-slate-900">{option}</p>
                      </div>
                    </Button>
                  )
                })}
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  selectedResult >= 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {selectedResult >= 0 ? `Selected option ${selectedResult + 1}` : 'No answer selected yet'}
              </div>
              <Button
                onClick={finishGame}
                disabled={selectedResult < 0}
                className="w-full bg-rose-600 text-white hover:bg-rose-600/90"
              >
                Reveal answer and announce winners
              </Button>
            </>
          ) : hasResolved ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Revealed answer: option {selectedResult + 1}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Start the game to let players answer, then return here to reveal the result</p>
          )}
        </CardContent>
      </Card>
    )
  }

  const renderResultCard = () => {
    if (!gameResult) return null

    return (
      <Card className="border shadow-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-lg text-slate-800">Results</CardTitle>
          <CardDescription className="text-sm text-slate-500">
            {gameResult.winners.length > 0 ? 'Perfect answers take the prize' : 'No winners this round'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
              {gameResult.winners.length > 0 ? (
                <div className="space-y-3">
                  {gameResult.winners.map((winner, index) => (
                    <div key={winner.id} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="font-semibold text-slate-800">{winner.id === user.id ? 'You' : `Player ${index + 1}`}</p>
                      <p className="text-sm text-emerald-700">Won {gameResult.winAmount}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  Nobody answered every question correctly
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <Button onClick={playAgain} className="bg-slate-900 text-white hover:bg-slate-900/90">Choose another game</Button>
                <Button onClick={goToRoom} variant="outline">Return to room</Button>
              </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <GameShell
      roomId={roomId}
      title="Match Fixing Game"
      description={isHost ? 'Set a question and reveal the real answer' : 'Answer correctly to win the shared pot'}
      className="text-slate-900"
      showToolbar={false}
    >
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border shadow-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg text-slate-800">Game status</CardTitle>
              <CardDescription className="text-sm text-slate-500">{statusCopy[gameStatus]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">{renderMainSection()}</CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg text-slate-800">Total prize pool</CardTitle>
                <CardDescription className="text-sm text-slate-500">Collected from all bets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-4xl font-bold text-slate-900">{totalPrizePool}</p>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Participants</span>
                    <span className="font-semibold text-slate-800">{players.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Prepared questions</span>
                    <span className="font-semibold text-slate-800">{questions.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {renderHostControlsCard()}
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-slate-800">Players</CardTitle>
            <CardDescription className="text-xs text-slate-500">See who joined and how much they bet</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {players.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                No players yet
              </div>
            )}

            {players.map((player, index) => (
              <div
                key={player.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">
                    {player.id === user.id ? 'You' : `Player ${index + 1}`}
                    {player.id === user.id && isHost && ' (Host)'}
                  </div>
                  {player.id === user.id && (
                    <Badge variant="secondary" className="text-[11px] uppercase">
                      You
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500">Bet {player.betAmount}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {renderQuestionPreviewCard()}
        {renderResultCard()}
      </div>
    </GameShell>
  )
}
