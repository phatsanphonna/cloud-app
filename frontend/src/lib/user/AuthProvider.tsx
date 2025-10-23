'use client'

import { FC } from "react"
import { useUser } from "."
import { redirect } from "next/navigation"

interface Props {
  children: React.ReactNode
}

export const AuthProvider: FC<Props> = ({ children }) => {
  const [user] = useUser()

  if (!user) {
    return redirect("/signin")
  }

  return children
}

export const NoAuthProvider: FC<Props> = ({ children }) => {
  const [user] = useUser()

  if (user) {
    return redirect("/")
  }

  return children
}