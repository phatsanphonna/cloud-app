'use client'

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { NextPage } from "next"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"
import { register } from "./actions"

const RegisterPage: NextPage = () => {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!username) {
      toast.error("Username is required");
      return;
    }

    setLoading(true);
    const { message } = await register(username);

    if (message) {
      toast(message);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Register
      </h3>

      <div className="flex flex-col gap-2">
        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          placeholder="ChotikarnZa007"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button onClick={handleRegister} disabled={loading || !username}>
          {loading && <Spinner />}
          Register
        </Button>
      </div>
      <Link href='/signin' className={buttonVariants({ variant: 'outline' })}>
        Sign In
      </Link>
    </div>
  )
}

export default RegisterPage