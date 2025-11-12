'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { joinWSGame, useWSClient, useWSMessage, useWSSend } from '@/lib/ws'
import { LogInIcon } from 'lucide-react'
import Link from 'next/link'
import { FC, useState } from 'react'
import { joinGame } from './actions'
import { toast } from 'sonner'
import { useGameRoomId, useGameState } from '@/lib/gameplay'
import { useRouter } from 'next/navigation'
import { joinRoom as joinRoomAction } from './actions'

const Operation: FC = () => {
  const router = useRouter()

  const [joinRoomOpen, setJoinRoomOpen] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [, setMessage] = useWSMessage()
  const [, setWS] = useWSClient()
  const [, setGameState] = useGameState()
  const [, setGameId] = useGameRoomId()

  const joinRoom = async () => {
    try {
      const { status, data } = await joinRoomAction(roomCode)

      console.log("Join room response:", { status, data })

      if (status !== 200) {
        if (status === 401) {
          toast.error("Please sign in before joining a room")
          router.push('/signin')
          return
        }
        if (status === 404) {
          toast.error("Room not found, please double-check the code")
          return
        }
        console.error("Failed to join room:", data)
        toast.error(data?.message || "Unable to join the room")
        return
      }

      if (!data?.roomId) {
        console.error("No room ID returned:", data)
        toast.error("Invalid response from server")
        return
      }

      // Redirect to the room page
      router.push(`/room/${data.roomId}`)
    } catch (error) {
      console.error("Failed to join room:", error)
      toast.error("Unable to join the room")
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {joinRoomOpen && (
        <>
          <Input
            placeholder="Enter room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className='text-center'
            inputMode='text'
          />
          <Button onClick={joinRoom}>
            <LogInIcon />
            Join room
          </Button>
        </>
      )}

      {!joinRoomOpen && (
        <Button onClick={() => setJoinRoomOpen(true)}>
          Join room
        </Button>
      )}
    </div>
  )
}

export default Operation
