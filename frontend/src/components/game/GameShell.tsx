"use client"

import BackButton from "@/components/next/BackButton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface GameShellProps {
  roomId: string | null
  title: string
  description?: string
  children: ReactNode
  headerAddon?: ReactNode
  className?: string
  showBackButton?: boolean
  showToolbar?: boolean
}

export function GameShell({
  roomId,
  title,
  description,
  children,
  headerAddon,
  className,
  showBackButton = true,
  showToolbar = true,
}: GameShellProps) {
  const shouldRenderToolbar = showToolbar && (showBackButton || headerAddon)

  return (
    <div className={cn("min-h-screen w-full p-4 text-slate-900", className)}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        {shouldRenderToolbar && (
          <div className="flex items-center justify-between gap-3">
            {showBackButton ? <BackButton /> : <span />}
            {headerAddon}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Game Center</p>
              <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
              {description && <p className="text-sm text-slate-500">{description}</p>}
            </div>
            {roomId && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="font-semibold text-slate-700">Room</span>
                <Badge variant="outline" className="font-mono text-xs uppercase tracking-wide">
                  {roomId}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
