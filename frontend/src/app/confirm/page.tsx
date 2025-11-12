'use client'

import { Input } from "@/components/ui/input"
import { NextPage } from "next"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { CheckCircle, RefreshCw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import BackButton from "@/components/next/BackButton"
import { useSearchParams, useRouter } from "next/navigation"
import { confirmSignUp, resendConfirmationCode } from "./actions"

const ConfirmPage: NextPage = () => {
  const [confirmationCode, setConfirmationCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const username = searchParams.get('username') || ""
  const email = searchParams.get('email') || ""

  useEffect(() => {
    if (!username) {
      router.push('/register')
    }
  }, [username, router])

  const handleConfirm = async () => {
    if (!confirmationCode) {
      toast.error("Please enter the verification code");
      return;
    }

    setLoading(true);
    
    const { success, message } = await confirmSignUp(username, confirmationCode);

    if (success) {
      toast.success(message);
      setTimeout(() => {
        router.push('/signin');
      }, 2000);
    } else {
      toast.error(message);
    }
    
    setLoading(false);
  }

  const handleResendCode = async () => {
    setResending(true);
    
    const { success, message } = await resendConfirmationCode(username);

    if (success) {
      toast.success(message);
    } else {
      toast.error(message);
    }
    
    setResending(false);
  }

  if (!username) {
    return null; // Will redirect to register
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <BackButton />
      <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
        Confirm your email
      </h3>

      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          We sent a verification code to <strong>{email}</strong>
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
          Check your inbox (and spam folder) and enter the six-digit code below.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor='username'>Username</Label>
        <Input
          id='username'
          value={username}
          disabled
          className="bg-gray-50 dark:bg-gray-900"
        />
        
        <Label htmlFor='confirmationCode'>Verification code</Label>
        <Input
          id='confirmationCode'
          placeholder="123456"
          value={confirmationCode}
          onChange={(e) => setConfirmationCode(e.target.value)}
          maxLength={6}
        />
        
        <Button onClick={handleConfirm} disabled={loading || !confirmationCode}>
          {loading ? <Spinner /> : <CheckCircle />}
          Confirm email
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleResendCode} 
          disabled={resending}
        >
          {resending ? <Spinner /> : <RefreshCw />}
          Resend code
        </Button>
      </div>
      
      <div className="text-center">
        <Link href='/signin' className={buttonVariants({ variant: 'ghost' })}>
          Already verified? Sign in
        </Link>
      </div>
    </div>
  )
}

export default ConfirmPage
