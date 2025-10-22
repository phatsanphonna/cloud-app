'use client'

import { useGameState } from "@/lib/gameplay"
import { NextPage } from "next"
import GameLobby from "./ui/Lobby"
import GamePlaying from "./ui/Playing"

const GamePage: NextPage = () => {
  const [state] = useGameState()

  if (state === "lobby") {
    return <GameLobby />
  }

  if (state === "playing") {
    return <GamePlaying />
  }
}

export default GamePage