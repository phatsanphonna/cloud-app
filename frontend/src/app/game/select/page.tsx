"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import BackButton from '@/components/next/BackButton'

const GAME_TYPES = [
  { 
    id: 'roll-dice', 
    name: 'Roll Dice', 
    short: 'RD',
    description: 'Guess the six-sided die. Correct guesses share the pot.',
    color: 'from-red-500 to-pink-500'
  },
  { 
    id: 'spin-wheel', 
    name: 'Spin Wheel', 
    short: 'SW',
    description: 'One random winner takes everything.',
    color: 'from-blue-500 to-cyan-500'
  },
  { 
    id: 'match-fixing', 
    name: 'Match Fixing', 
    short: 'MF',
    description: 'Host sets the real answer. Be on the right side.',
    color: 'from-green-500 to-emerald-500'
  },
  { 
    id: 'vote', 
    name: 'Vote', 
    short: 'VT',
    description: 'Majority wins and collects the prize.',
    color: 'from-purple-500 to-indigo-500'
  }
]

export default function GameSelectionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = searchParams.get('roomId')
  
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem('user')
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      router.push('/signin')
    }

    // Check if we have roomId
    if (!roomId) {
      router.push('/')
    }
  }, [router, roomId])

  const selectGame = (gameType: string) => {
    router.push(`/betting/${roomId}?gameType=${gameType}`)
  }

  if (!user || !roomId) return <div>Loading…</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-4">
      <BackButton />
      
      <div className="max-w-4xl mx-auto pt-16">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose a game
          </h1>
          <p className="text-white/80 text-lg">
            Pick a game mode and start betting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {GAME_TYPES.map((game) => (
            <Card 
              key={game.id} 
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all cursor-pointer"
              onClick={() => selectGame(game.id)}
            >
              <CardHeader>
                <CardTitle className="text-white text-2xl text-center">
                  {game.name}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="text-center">
                <div className={`w-20 h-20 rounded-full bg-gradient-to-r ${game.color} mx-auto mb-4 flex items-center justify-center text-2xl font-bold tracking-wide`}>
                  {game.short}
                </div>
                
                <p className="text-white/90 mb-6">
                  {game.description}
                </p>
                
                <Button 
                  className="w-full bg-white/20 hover:bg-white/30 border-white/30"
                  onClick={(e) => {
                    e.stopPropagation()
                    selectGame(game.id)
                  }}
                >
                  Play this game
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
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
