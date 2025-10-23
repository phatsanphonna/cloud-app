'use client'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { joinWSGame, useWSClient, useWSMessage, useWSSend } from '@/lib/ws'
import { LogInIcon } from 'lucide-react'
import Link from 'next/link'
import { FC, useState } from 'react'
import { joinGame } from './actions'
import { toast } from 'sonner'
import { useGameState } from '@/lib/gameplay'
import { useRouter } from 'next/navigation'

const Operation: FC = () => {
  const router = useRouter()

  const [joinRoomOpen, setJoinRoomOpen] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [, setMessage] = useWSMessage()
  const [, setWS] = useWSClient()
  const [, setGameState] = useGameState()

  const joinRoom = async () => {
    try {
      const { status, data } = await joinGame(roomCode)

      if (status !== 200) {
        toast.error("Failed to join game room.")
        return
      }

      const { gameId } = data

      const client = joinWSGame(gameId)

      client.addEventListener('open', () => {
        console.log('Game joined:', gameId);
      });


      client.addEventListener('close', () => {
        console.log("WebSocket Client Disconnected");
        setWS(null);
      });

      client.addEventListener('message', ({ data }) => {
        console.log("WebSocket Message Received:", data);
        data = JSON.parse(data);

        setMessage(data);
        setGameState(data.type);
      });

      setWS(client)

      router.push(`/game`)
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