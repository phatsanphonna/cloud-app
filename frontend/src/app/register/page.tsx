'use client'

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { NextPage } from "next"
import Link from "next/link"
import BackButton from "@/components/next/BackButton"
import { useState } from "react"
import { toast } from "sonner"
import { register, registerWithCognito } from "./actions"
import { useRouter } from "next/navigation"

const RegisterPage: NextPage = () => {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async () => {
    if (!username) {
      toast.error("Please enter a username");
      return;
    }

    if (!password) {
      toast.error("Please enter a password");
      return;
    }

    if (!email) {
      toast.error("Please provide an email to register with Cognito");
      return;
    }

    setLoading(true);

    const result = await register(username, password, email);

    console.log("Registration result:", result); // Debug log

    if (result?.message) {
      if (result.status >= 400) {
        toast.error(result.message);
      } else {
        toast.success(result.message);

        // If Cognito registration successful, redirect to confirm page
        if (result.requiresConfirmation) {
          setTimeout(() => {
            router.push(`/confirm?username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
          }, 1000);
        }
      }
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <BackButton />
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Create an account
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
          placeholder="At least 8 characters with a number"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Label htmlFor='email'>Email <span className="text-red-500">*</span></Label>
        <Input
          id='email'
          type="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {email && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            A verification code will be sent to this email
          </p>
        )}


        <Button onClick={handleRegister} disabled={loading || !username || !password || !email}>
          {loading && <Spinner />}
          Create account with Cognito
        </Button>
      </div>
      <Link href='/signin' className={buttonVariants({ variant: 'outline' })}>
        Already have an account? Sign in
      </Link>
    </div>
  )
}

export default RegisterPage
