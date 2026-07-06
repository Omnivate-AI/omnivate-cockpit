"use client"

import { useState } from "react"
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface MarkDoneToggleProps {
  /** sp_campaigns.id (NOT the Smartlead id) */
  campaignSpId: number
  campaignName: string
  consideredDone: boolean
  onChanged?: () => void
}

/**
 * Operator switch: "this campaign is finished — stop counting it."
 * Writes cockpit_campaign_overrides.considered_done; done campaigns are
 * excluded from primary lead runway and the lead-runway alert. Smartlead
 * never auto-completes campaigns (Design Studios sat ACTIVE for two weeks
 * after draining), so done-ness is an operator call (Omar 2026-07-06).
 */
export function MarkDoneToggle({
  campaignSpId,
  campaignName,
  consideredDone,
  onChanged,
}: MarkDoneToggleProps) {
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignSpId}/considered-done`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !consideredDone }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success(
        !consideredDone
          ? `${campaignName} marked done — excluded from runway & alerts`
          : `${campaignName} reopened — counts toward runway again`
      )
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setLoading(false)
    }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={
              consideredDone
                ? "h-7 w-7 text-stone-500 hover:text-stone-700 dark:text-stone-400"
                : "h-7 w-7 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400"
            }
            onClick={(e) => {
              e.stopPropagation()
              toggle()
            }}
            disabled={loading}
            aria-label={consideredDone ? "Reopen campaign" : "Mark campaign done"}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : consideredDone ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {consideredDone
            ? "Reopen — count toward runway & alerts again"
            : "Mark done — exclude from runway & alerts"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
