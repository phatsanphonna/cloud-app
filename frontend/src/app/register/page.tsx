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
  const [useCognito, setUseCognito] = useState(true)
  const router = useRouter()

  const handleRegister = async () => {
    if (!username) {
      toast.error("Username is required");
      return;
    }

    if (useCognito && !password) {
      toast.error("Password is required");
      return;
    }

    if (useCognito && !email) {
      toast.error("Email is required for Cognito registration");
      return;
    }

    setLoading(true);
    
    let result;
    if (useCognito) {
      result = await register(username, password, email);
    } else {
      result = await register(username, password);
    }

    console.log("Registration result:", result); // Debug log

    if (result?.message) {
      if (result.status >= 400) {
        toast.error(result.message);
      } else {
        toast.success(result.message);
        
        // If Cognito registration successful, redirect to confirm page
        if (useCognito && result.requiresConfirmation) {
          setTimeout(() => {
            router.push(`/confirm?username=${encodeURIComponent(username)}&email=${encodeURIComponent(email)}`);
          }, 1000);
        }
      }
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <BackButton />
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Register
      </h3>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useCognito"
            checked={useCognito}
            onChange={(e) => setUseCognito(e.target.checked)}
          />
          <Label htmlFor="useCognito">Use Cognito Authentication</Label>
        </div>

        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          placeholder="ChotikarnZa007"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        
        {useCognito && (
          <>
            <Label htmlFor='password'>Password</Label>
            <Input
              id='password'
              type="password"
              placeholder="Your password (min 8 chars, include numbers)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            
            <Label htmlFor='email'>Email <span className="text-red-500">*</span></Label>
            <Input
              id='email'
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={useCognito}
            />
            
            {email && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                A confirmation code will be sent to this email address.
              </p>
            )}
          </>
        )}
        
        <Button onClick={handleRegister} disabled={loading || !username || (useCognito && (!password || !email))}>
          {loading && <Spinner />}
          Register {useCognito ? "with Cognito" : ""}
        </Button>
      </div>
      <Link href='/signin' className={buttonVariants({ variant: 'outline' })}>
        Sign In
      </Link>
    </div>
  )
}

export default RegisterPage
