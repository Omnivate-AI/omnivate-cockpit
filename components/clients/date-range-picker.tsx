"use client"

import { useState, useTransition } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateRangePickerProps {
  /** Currently applied range (from the URL), if any */
  from?: string
  to?: string
}

/**
 * Custom from–to range for the client page (V2 Phase 4). Writes ?from/?to —
 * the page re-renders the Overview tab inside its Suspense boundary, so the
 * apply shows the standard tab skeleton while data swaps (same loading
 * behavior as tab switches). Feedback is instant: the Apply button goes into
 * a spinner state the same frame it's clicked.
 */
export function DateRangePicker({ from, to }: DateRangePickerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().slice(0, 10)
  const [draftFrom, setDraftFrom] = useState(from ?? "")
  const [draftTo, setDraftTo] = useState(to ?? today)

  const valid =
    draftFrom !== "" && draftTo !== "" && draftFrom <= draftTo && draftTo <= today
  const isApplied = from != null

  function apply() {
    if (!valid) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", draftFrom)
    params.set("to", draftTo)
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function clear() {
    setDraftFrom("")
    setDraftTo(today)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("from")
    params.delete("to")
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  const inputCls =
    "h-8 rounded-md border bg-background px-2 text-xs text-foreground [color-scheme:light] dark:[color-scheme:dark]"

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        type="date"
        aria-label="From date"
        value={draftFrom}
        max={draftTo || today}
        onChange={(e) => setDraftFrom(e.target.value)}
        className={inputCls}
      />
      <span className="text-xs text-muted-foreground">–</span>
      <input
        type="date"
        aria-label="To date"
        value={draftTo}
        min={draftFrom || undefined}
        max={today}
        onChange={(e) => setDraftTo(e.target.value)}
        className={inputCls}
      />
      <button
        onClick={apply}
        disabled={!valid || isPending}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
          valid && !isPending
            ? "bg-foreground text-background hover:opacity-90"
            : "bg-muted text-muted-foreground cursor-not-allowed"
        )}
      >
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        Apply
      </button>
      {isApplied && (
        <button
          onClick={clear}
          disabled={isPending}
          aria-label="Clear custom range"
          className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  )
}
