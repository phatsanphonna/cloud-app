"use client"

import { Button } from "@/components/ui/button"
import { usePathname, useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { FC } from "react"

const BackButton: FC = () => {
  const router = useRouter()
  const pathname = usePathname()

  // Hide on game pages
  if (pathname?.startsWith("/game")) return null

  return (
    <Button variant="ghost" size="sm" onClick={() => router.back()} className="px-2">
      <ChevronLeft className="h-4 w-4" />
      Back
    </Button>
  )
}

export default BackButton
