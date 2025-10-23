'use client'

import { Input } from "@/components/ui/input"
import { NextPage } from "next"
import { useState } from "react"
import { signIn } from "./actions"
import { toast } from "sonner"
import { LogIn } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import Link from "next/link"

const SignInPage: NextPage = () => {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    if (!username) {
      toast.error("Username is required");
      return;
    }

    setLoading(true);
    const { data, status } = await signIn(username);

    if (status === 404) {
      toast.error(data.message);
    } else {
      toast.success(data.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Sign In
      </h3>

      <div className="flex flex-col gap-2">
        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          placeholder="ChotikarnZa007"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button onClick={handleSignIn} disabled={loading || !username}>
          {loading ? <Spinner /> : <LogIn />}
          Sign In
        </Button>
      </div>
      <Link href='/register' className={buttonVariants({ variant: 'outline' })}>
        Register
      </Link>
    </div>
  )
}

export default SignInPage