"use client"

import { NextPage } from "next"
import { useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import BackButton from "@/components/next/BackButton"
import { createRoom } from "./actions"

const GAME_TYPES = [
  { id: "roll-dice", label: "Roll Dice" },
  { id: "spin-wheel", label: "Spin the Wheel" },
  { id: "match-fixing", label: "Match Fixing" },
  { id: "vote", label: "Vote" },
] as const

type GameType = (typeof GAME_TYPES)[number]["id"]

const CreateRoomPage: NextPage = () => {
  const [title, setTitle] = useState("")
  const [rounds, setRounds] = useState(3)
  const [minPlayer, setMinPlayer] = useState(2)
  const [gameType, setGameType] = useState<GameType>("roll-dice")
  const [isPending, startTransition] = useTransition()

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          window.location.href = '/signin'
          return
        }
        
        await createRoom(minPlayer, gameType, token)
      } catch (error) {
        console.error("Failed to create room:", error)
        // You might want to show a toast or error message here
      }
    })
  }

  return (
    <div className="self-stretch w-full h-full flex flex-col items-center p-4 sm:p-6 gap-3">
      <div className="w-full max-w-md">
        <BackButton />
      </div>
      <Card className="w-full max-w-md border shadow-md">
        <CardHeader>
          <CardTitle>Create room</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Friday Night" />
          </div>
          <div>
            <Label>Game Type</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {GAME_TYPES.map(({ id, label }) => (
                <Button
                  key={id}
                  variant={gameType === id ? 'default' : 'outline'}
                  onClick={() => setGameType(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Minimum Players</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[2,3,4,5].map((n) => (
                <Button key={n} variant={minPlayer===n?"default":"outline"} onClick={() => setMinPlayer(n)}>{n}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Rounds</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[1,2,3].map((n) => (
                <Button key={n} variant={rounds===n?"default":"outline"} onClick={() => setRounds(n)}>{n}</Button>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleCreate} disabled={isPending}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default CreateRoomPage
