"use client"

import { useState } from "react"
import { Pause, Play, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CampaignActionsProps {
  smartleadCampaignId: number
  campaignName: string
  isActive: boolean
  onStatusChange?: () => void
}

export function CampaignActions({
  smartleadCampaignId,
  campaignName,
  isActive,
  onStatusChange,
}: CampaignActionsProps) {
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function updateStatus(status: "PAUSED" | "START") {
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${smartleadCampaignId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to update status")
      }
      toast.success(
        status === "PAUSED"
          ? `${campaignName} paused`
          : `${campaignName} resumed`
      )
      setPauseDialogOpen(false)
      onStatusChange?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setLoading(false)
    }
  }

  const smartleadUrl = `https://app.smartlead.ai/app/email-campaign/${smartleadCampaignId}/campaign-details`

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {isActive ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
                onClick={() => setPauseDialogOpen(true)}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Pause campaign sending</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                onClick={() => updateStatus("START")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Resume campaign sending</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              asChild
            >
              <a href={smartleadUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">View in Smartlead</TooltipContent>
        </Tooltip>

        {/* Pause confirmation dialog */}
        <Dialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pause Campaign</DialogTitle>
              <DialogDescription>
                Are you sure you want to pause <strong>{campaignName}</strong>? This
                will stop all email sending for this campaign. You can resume it later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPauseDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => updateStatus("PAUSED")}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pause Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
