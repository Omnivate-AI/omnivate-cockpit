"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const INTERVALS = [
  { label: "Off", seconds: 0 },
  { label: "1 min", seconds: 60 },
  { label: "5 min", seconds: 300 },
  { label: "15 min", seconds: 900 },
] as const

const STORAGE_KEY = "dashboard-auto-refresh"

function loadInterval(): number {
  if (typeof window === "undefined") return 0
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return 0
  const n = Number(stored)
  return INTERVALS.some((i) => i.seconds === n) ? n : 0
}

export function AutoRefresh() {
  const router = useRouter()
  const [interval, setIntervalSeconds] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadInterval()
    if (saved > 0) {
      setIntervalSeconds(saved)
      setRemaining(saved)
    }
  }, [])

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  // Set up timers when interval changes
  useEffect(() => {
    clearTimers()

    if (interval <= 0) return

    setRemaining(interval)

    // Countdown every second
    countdownRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) return interval
        return prev - 1
      })
    }, 1000)

    // Refresh at interval
    timerRef.current = setInterval(() => {
      router.refresh()
      setRemaining(interval)
    }, interval * 1000)

    return clearTimers
  }, [interval, router, clearTimers])

  const handleSelect = (seconds: number) => {
    setIntervalSeconds(seconds)
    if (typeof window !== "undefined") {
      if (seconds === 0) {
        localStorage.removeItem(STORAGE_KEY)
      } else {
        localStorage.setItem(STORAGE_KEY, String(seconds))
      }
    }
  }

  const activeLabel = INTERVALS.find((i) => i.seconds === interval)?.label ?? "Off"

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${interval > 0 ? "animate-spin-slow text-emerald-500" : ""}`} />
          {interval > 0 ? (
            <span className="tabular-nums">{formatCountdown(remaining)}</span>
          ) : (
            <span className="hidden sm:inline">Auto</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {INTERVALS.map((opt) => (
          <DropdownMenuItem
            key={opt.seconds}
            onClick={() => handleSelect(opt.seconds)}
            className={interval === opt.seconds ? "bg-accent" : ""}
          >
            {opt.label}
            {interval === opt.seconds && (
              <span className="ml-auto text-xs text-emerald-500">Active</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
