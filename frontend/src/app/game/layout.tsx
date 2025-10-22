'use client'

import { useGameState } from "@/lib/gameplay"
import { redirect } from "next/navigation"
import { FC } from "react"

interface Props {
  children: React.ReactNode
}

const GameLayout: FC<Props> = ({ children }) => {
  const [state] = useGameState()

  if (state === "none") {
    return redirect("/")
  }

  return (
    <>{children}</>
  )
}

export default GameLayout