'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { joinWSGame, useWSMessage, useWSSend } from '@/lib/ws'
import { LogInIcon } from 'lucide-react'
import Link from 'next/link'
import { FC, useState } from 'react'
import { joinGame } from './actions'

const Operation: FC = () => {
  const [joinRoomOpen, setJoinRoomOpen] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [message] = useWSMessage()

  const joinRoom = async () => {
    try {
      const { } = await joinGame(roomCode)

      joinWSGame(roomCode)
    } catch (error) {
      console.error("Failed to join game:", error)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {joinRoomOpen && (
        <>
          <Input
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className='text-center'
            inputMode='text'
          />
          <Button onClick={joinRoom}>
            <LogInIcon />
            Join Room
          </Button>
        </>
      )}

      {!joinRoomOpen && (
        <Button onClick={() => setJoinRoomOpen(true)}>
          Join Room
        </Button>
      )}

      {!joinRoomOpen && (
        <Link
          href="/create-room"
          className={buttonVariants({
            variant: 'outline',
          })}
        >
          Create Room
        </Link>
      )}

      <Link
        href="/lobby"
        className={buttonVariants({
          variant: 'outline',
        })}
      >
        Lobby
      </Link>
    </div>
  )
}

export default Operation