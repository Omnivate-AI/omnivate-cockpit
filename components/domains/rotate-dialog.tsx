"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2 } from "lucide-react"
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
import { createClient } from "@/lib/supabase/client"

interface RotateDialogProps {
  domainId: number
  domainName: string
  client: string
  accountCount?: number | null
  masterInboxEmail?: string | null
  alertId?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RotateDialog({
  domainId,
  domainName,
  client,
  accountCount: accountCountProp,
  masterInboxEmail: masterInboxEmailProp,
  alertId,
  open,
  onOpenChange,
}: RotateDialogProps) {
  const router = useRouter()
  const [status, setStatus] = useState<
    "idle" | "triggering" | "polling" | "success" | "error"
  >("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [accountCount, setAccountCount] = useState(accountCountProp ?? 0)
  const [masterInboxEmail, setMasterInboxEmail] = useState(
    masterInboxEmailProp ?? null
  )
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Reset state and fetch extra data when dialog opens
  useEffect(() => {
    if (open) {
      setStatus("idle")
      setErrorMessage("")
      cleanup()

      // Fetch extra data if not provided via props
      if (accountCountProp == null || masterInboxEmailProp === undefined) {
        const supabase = createClient()
        // Fetch account count for this domain
        supabase
          .from("vw_cockpit_accounts")
          .select("*", { count: "exact", head: true })
          .eq("domain_id", domainId)
          .then(({ count }) => {
            if (count != null) setAccountCount(count)
          })
        // Fetch master inbox email for this client
        supabase
          .from("vw_cockpit_accounts")
          .select("email")
          .eq("client", client)
          .eq("is_master_inbox", true)
          .limit(1)
          .single()
          .then(({ data }) => {
            if (data) setMasterInboxEmail(data.email)
          })
      } else {
        setAccountCount(accountCountProp)
        setMasterInboxEmail(masterInboxEmailProp)
      }
    }
  }, [open, cleanup, domainId, client, accountCountProp, masterInboxEmailProp])

  async function handleRotate() {
    setStatus("triggering")
    setErrorMessage("")

    try {
      const res = await fetch("/api/rotate-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, alertId: alertId ?? null }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setErrorMessage(data.error || "Failed to trigger rotation")
        return
      }

      // Start polling for completion
      setStatus("polling")
      startPolling()
    } catch {
      setStatus("error")
      setErrorMessage("Network error — could not reach the server")
    }
  }

  function startPolling() {
    const supabase = createClient()

    // Poll the actions log for rotation completion
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("vw_cockpit_actions")
        .select("status, error")
        .eq("domain_id", domainId)
        .eq("action_type", "rotate_burnt")
        .order("created_at", { ascending: false })
        .limit(1)

      if (data && data.length > 0) {
        const action = data[0]
        if (action.status === "completed") {
          cleanup()
          setStatus("success")
          toast.success("Domain rotated successfully", {
            description: `${domainName} has been set to receive-only mode`,
          })
          onOpenChange(false)
          router.refresh()
        } else if (action.status === "failed") {
          cleanup()
          setStatus("error")
          setErrorMessage(action.error || "Rotation task failed")
          toast.error("Rotation failed", {
            description: action.error || "Check the audit log for details",
          })
        }
      }
    }, 3000)

    // Timeout after 60 seconds
    timeoutRef.current = setTimeout(() => {
      cleanup()
      setStatus("idle")
      toast.warning("Rotation is taking longer than expected", {
        description:
          "The task is still running. Check the audit log for updates.",
      })
      onOpenChange(false)
      router.refresh()
    }, 60000)
  }

  const isLoading = status === "triggering" || status === "polling"

  return (
    <Dialog open={open} onOpenChange={isLoading ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Rotate Domain</DialogTitle>
          <DialogDescription>
            This action will take the burnt domain out of active campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Domain info */}
          <div className="rounded-lg border p-4 bg-stone-50 dark:bg-accent/50">
            <p className="text-sm font-medium">{domainName}</p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {client}
            </p>
          </div>

          {/* Warning */}
          <div className="flex gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                This will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
                <li>Remove all accounts from active campaigns</li>
                <li>Set catch-all forwarding to master inbox</li>
                <li>Change domain status to &quot;receive_only&quot;</li>
                <li>Log the action for audit</li>
              </ul>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Master inbox target</p>
              <p className="font-mono text-xs mt-0.5">
                {masterInboxEmail || (
                  <span className="text-amber-600">None configured</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Affected accounts</p>
              <p className="font-medium mt-0.5">{accountCount}</p>
            </div>
          </div>

          {/* Error message */}
          {status === "error" && errorMessage && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3">
              <p className="text-sm text-rose-700 dark:text-rose-400">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Polling status */}
          {status === "polling" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Rotation in progress...</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRotate}
            disabled={isLoading}
          >
            {status === "triggering" ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Triggering...
              </>
            ) : status === "polling" ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Rotating...
              </>
            ) : (
              "Rotate Domain"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
