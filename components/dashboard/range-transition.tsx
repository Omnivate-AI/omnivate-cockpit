"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { DEFAULT_RANGE, type RangeValue } from "@/lib/range-utils"

interface RangeTransitionValue {
  /** Range to render as pressed — optimistic while a switch is in flight */
  displayRange: string
  /** True from click until the server render for the new range lands */
  isPending: boolean
  navigate: (value: RangeValue) => void
}

const RangeTransitionContext = createContext<RangeTransitionValue | null>(null)

/**
 * V2 Phase 4 — instant feedback for the Command Center range switch. The
 * pressed state used to be derived from the URL, so nothing on screen moved
 * until the full server round-trip finished (measured 1.5–1.8s on
 * production). Now the clicked button presses the same frame, and every
 * range-driven region (wrapped in <RangeVeil>) dims-and-pulses until the
 * fresh data lands.
 */
export function RangeTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  // Split priorities (same trick as ClientTabs): the pressed button paints
  // urgently; veiling two large page regions (class flip → big repaint)
  // happens in the transition a frame later.
  const [pressedRange, setPressedRange] = useState<string | null>(null)
  const [veilRange, setVeilRange] = useState<string | null>(null)

  const urlRange = searchParams.get("range") ?? DEFAULT_RANGE

  // Server caught up → back to URL-derived state
  useEffect(() => {
    if (pressedRange !== null && pressedRange === urlRange) setPressedRange(null)
    if (veilRange !== null && veilRange === urlRange) setVeilRange(null)
  }, [pressedRange, veilRange, urlRange])

  const navigate = (value: RangeValue) => {
    setPressedRange(value) // urgent: pressed state paints this frame
    const params = new URLSearchParams(searchParams.toString())
    if (value === DEFAULT_RANGE) {
      params.delete("range")
    } else {
      params.set("range", value)
    }
    const qs = params.toString()
    startTransition(() => {
      setVeilRange(value) // deferred: dim the data regions
      router.push(qs ? `/?${qs}` : "/", { scroll: false })
    })
  }

  const value: RangeTransitionValue = {
    displayRange: pressedRange ?? urlRange,
    isPending: veilRange !== null && veilRange !== urlRange,
    navigate,
  }

  return (
    <RangeTransitionContext.Provider value={value}>
      {children}
    </RangeTransitionContext.Provider>
  )
}

export function useRangeTransition(): RangeTransitionValue {
  const ctx = useContext(RangeTransitionContext)
  if (!ctx) {
    throw new Error("useRangeTransition must be used inside RangeTransitionProvider")
  }
  return ctx
}

/** Dims + pulses its (server-rendered) children while a range switch loads. */
export function RangeVeil({ children }: { children: ReactNode }) {
  const { isPending } = useRangeTransition()
  return (
    <div
      aria-busy={isPending}
      className={cn(
        "transition-opacity duration-200",
        isPending && "pointer-events-none animate-pulse opacity-50"
      )}
    >
      {children}
    </div>
  )
}
