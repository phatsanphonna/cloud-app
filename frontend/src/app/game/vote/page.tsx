"use client"

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import BackButton from '@/components/next/BackButton'
import { buildWsProtocols, buildWsUrl } from '@/lib/config'

interface VoteOption {
  id: string
  text: string
  votes: number
}

interface Player {
  id: string
  name: string
  betAmount: number
  vote: string | null
}

interface GameResult {
  winningOption: VoteOption | null
  winners: Player[]
  winAmount: number
}

export default function VoteGamePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const roomId = searchParams.get('roomId')
  const gameId = searchParams.get('gameId')
  
  const [user, setUser] = useState<any>(null)
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [isHost, setIsHost] = useState(false)
  const [gameStatus, setGameStatus] = useState<'setup' | 'voting' | 'finished'>('setup')
  const [voteOptions, setVoteOptions] = useState<VoteOption[]>([])
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [gameResult, setGameResult] = useState<GameResult | null>(null)
  const [totalPrizePool, setTotalPrizePool] = useState<number>(0)

  // Host setup states
  const [newOptionText, setNewOptionText] = useState('')

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

    const websocket = new WebSocket(buildWsUrl(`/game/vote/${gameId}`), buildWsProtocols(token))
    
    websocket.onopen = () => {
      console.log('Connected to Vote game')
      setWs(websocket)
      websocket.send(JSON.stringify({ type: 'get_game_status' }))
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      console.log('Received Vote message:', data)
      
      if (data.type === 'game_status') {
        setPlayers(data.players)
        setTotalPrizePool(data.totalPrizePool)
        setGameStatus(data.gameStatus)
        setIsHost(data.hostId === user.id)
        if (data.voteOptions) setVoteOptions(data.voteOptions)
      }
      
      if (data.type === 'option_added') {
        setVoteOptions(data.voteOptions)
        setNewOptionText('')
      }
      
      if (data.type === 'voting_started') {
        setGameStatus('voting')
      }
      
      if (data.type === 'vote_submitted') {
        setVoteOptions(data.voteOptions)
        setPlayers(data.players)
      }
      
      if (data.type === 'game_finished') {
        setGameResult({
          winningOption: data.winningOption,
          winners: data.winners,
          winAmount: data.winAmount
        })
        setGameStatus('finished')
        
        // Update winner balance locally
        if (data.winners.some((w: Player) => w.id === user.id)) {
          const updatedUser = { ...user, money: user.money + data.winAmount }
          setUser(updatedUser)
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      }
    }

    websocket.onclose = () => {
      console.log('Disconnected from Vote game')
      setWs(null)
    }

    return () => {
      websocket.close()
    }
  }, [user, gameId])

  const addOption = () => {
    if (!ws || !newOptionText.trim()) return
    
    ws.send(JSON.stringify({
      type: 'add_option',
      text: newOptionText
    }))
  }

  const startVoting = () => {
    if (!ws || voteOptions.length < 2) return
    
    ws.send(JSON.stringify({ type: 'start_voting' }))
  }

  const submitVote = (optionId: string) => {
    if (!ws || gameStatus !== 'voting' || selectedVote) return
    
    setSelectedVote(optionId)
    
    ws.send(JSON.stringify({
      type: 'submit_vote',
      optionId
    }))
  }

  const finishVoting = () => {
    if (!ws || !isHost) return
    
    ws.send(JSON.stringify({ type: 'finish_voting' }))
  }

  const playAgain = () => {
    router.push(`/room/${roomId}`)
  }

  const goToRoom = () => {
    router.push(`/room/${roomId}`)
  }

  if (!user || !roomId || !gameId) return <div>Loading…</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
      <BackButton />
      
      <div className="max-w-4xl mx-auto pt-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Vote Game
          </h1>
          <p className="text-white/80">
            {isHost ? 'Create options for players to vote on' : 'Vote for the option you prefer'}
          </p>
        </div>

        {/* Prize Pool */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">
              Total prize pool
            </h2>
            <div className="text-4xl font-bold text-white">
              {totalPrizePool}
            </div>
          </CardContent>
        </Card>

        {/* Host Setup Phase */}
        {isHost && gameStatus === 'setup' && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                Configure options ({voteOptions.length} total)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-white">New option</Label>
                <Input
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  placeholder="Type an option..."
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="flex gap-4">
                <Button 
                  onClick={addOption}
                  disabled={!newOptionText.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Add option
                </Button>
                {voteOptions.length >= 2 && (
                  <Button 
                    onClick={startVoting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Start voting ({voteOptions.length} options)
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Option List */}
        {voteOptions.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                All options
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voteOptions.map((option, index) => (
                  <div 
                    key={option.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      gameStatus === 'voting' && !selectedVote
                        ? 'cursor-pointer hover:bg-white/20 border-white/30'
                        : 'border-white/20'
                    } ${
                      selectedVote === option.id 
                        ? 'bg-blue-500/30 border-blue-400' 
                        : 'bg-white/5'
                    }`}
                    onClick={() => gameStatus === 'voting' && !selectedVote && submitVote(option.id)}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">{String.fromCharCode(65 + index)}</div>
                      <div className="text-white font-semibold mb-2">
                        {option.text}
                      </div>
                      {gameStatus === 'finished' && (
                        <div className="text-sm text-white/70">
                          {option.votes} vote(s)
                        </div>
                      )}
                      {selectedVote === option.id && (
                        <div className="text-green-400 text-sm mt-2">
                          You selected this option
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {gameStatus === 'voting' && selectedVote && (
                <div className="mt-4 text-center text-green-400">
                  Your vote has been recorded. Waiting for other players…
                </div>
              )}
              
              {isHost && gameStatus === 'voting' && (
                <div className="mt-4 text-center">
                  <Button 
                    onClick={finishVoting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Finish voting
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Wait for Host */}
        {!isHost && gameStatus === 'setup' && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardContent className="p-8 text-center">
              <div className="text-white">
                <h3 className="text-xl font-semibold mb-4">Waiting for the host to add options</h3>
                <p className="text-white/70">The host is preparing the list of choices…</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Result */}
        {gameResult && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
            <CardHeader>
              <CardTitle className="text-white text-xl text-center">
                Voting results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                {gameResult.winningOption ? (
                  <div>
                    <div className="bg-yellow-500/20 p-4 rounded-lg mb-4">
                      <h3 className="text-xl font-bold text-yellow-400 mb-2">
                        Winning option
                      </h3>
                      <div className="text-white text-lg">
                        {gameResult.winningOption.text}
                      </div>
                      <div className="text-yellow-300 text-sm">
                        {gameResult.winningOption.votes} vote(s)
                      </div>
                    </div>

                    {gameResult.winners.length > 0 ? (
                      <div>
                        <h3 className="text-xl font-bold text-green-400 mb-4">
                          Winners (correct vote)
                        </h3>
                        <div className="space-y-2">
                          {gameResult.winners.map((winner, index) => (
                            <div key={winner.id} className="bg-green-500/20 p-3 rounded-lg">
                              <div className="text-white font-semibold">
                                {winner.id === user.id ? 'You' : `Player ${index + 1}`}
                              </div>
                              <div className="text-green-400">
                                Payout: {gameResult.winAmount}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-500/20 p-4 rounded-lg">
                        <div className="text-red-400 font-semibold">
                          No winners
                        </div>
                        <div className="text-white/70">
                          Nobody voted for the winning option
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-500/20 p-4 rounded-lg">
                    <div className="text-gray-400 font-semibold">
                      Draw
                    </div>
                    <div className="text-white/70">
                      Every option received the same number of votes
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={playAgain}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Choose another game
                </Button>
                <Button 
                  onClick={goToRoom}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Return to room
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Players List */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
          <CardHeader>
            <CardTitle className="text-white text-xl text-center">
              Players
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player, index) => (
                <div key={player.id} className="bg-white/5 p-4 rounded-lg">
                  <div className="flex justify-between items-center text-white">
                    <div>
                      <div className="font-semibold">
                        {player.id === user.id ? 'You' : `Player ${index + 1}`}
                        {isHost && player.id === user.id && ' (Host)'}
                      </div>
                      <div className="text-sm text-white/70">
                        Bet: {player.betAmount}
                      </div>
                    </div>
                    <div className="text-sm">
                      {player.vote ? (
                        <span className="text-green-400">Voted</span>
                      ) : (
                        <span className="text-yellow-400">Waiting</span>
                      )}
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
                  Balance: <span className="font-semibold text-green-400">{user.money}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
