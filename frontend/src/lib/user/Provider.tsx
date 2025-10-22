'use client'

import { FC, useEffect } from "react"
import { useUser } from "."
import { getMe } from "./actions"

interface Props {
  children: React.ReactNode
}

const UserProvider: FC<Props> = ({ children }) => {
  const [, setUser] = useUser()

  useEffect(() => {
    console.log("Fetching user info...")
    getMe().then((user) => {
      setUser(user)
    })
  }, [])

  return children
}

export default UserProvider