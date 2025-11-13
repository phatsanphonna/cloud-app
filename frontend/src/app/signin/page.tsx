'use client'

import { Input } from "@/components/ui/input"
import { NextPage } from "next"
import { useState } from "react"
import { signIn, signInWithCognito } from "./actions"
import { toast } from "sonner"
import { LogIn } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import BackButton from "@/components/next/BackButton"
import { useRouter } from "next/navigation"

const SignInPage: NextPage = () => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignIn = async () => {
    if (!username) {
      toast.error("Please enter a username");
      return;
    }

    if (!password) {
      toast.error("Please enter a password");
      return;
    }

    setLoading(true);

    const result = await signInWithCognito(username, password);
    const { data, status } = result;

    if (status === 403 && data?.requiresConfirmation) {
      toast.error(data.message);
      // Redirect to confirmation page
      router.push(`/confirm?username=${encodeURIComponent(username)}&email=`);
    } else if (status === 404 || status === 401) {
      toast.error(data.message);
    } else if (status === 200) {
      toast.success(data.message);
    } else {
      toast.error("Sign in failed");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <BackButton />
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Sign in
      </h3>

      <div className="flex flex-col gap-2">
        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          placeholder="Somchai007"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Label htmlFor='password'>Password</Label>
        <Input
          id='password'
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button onClick={handleSignIn} disabled={loading || !username || !password} className={buttonVariants({ variant: 'default' })}>
          {loading ? <Spinner /> : <LogIn />}
          Sign in with Cognito
        </Button>
      </div>
      <Link href='/register' className={buttonVariants({ variant: 'outline' })}>
        Create an account
      </Link>
    </div>
  )
}

export default SignInPage
