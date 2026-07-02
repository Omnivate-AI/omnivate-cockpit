"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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

interface DismissDialogProps {
  alertId: number
  alertType: string
  domainName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DismissDialog({
  alertId,
  alertType,
  domainName,
  open,
  onOpenChange,
}: DismissDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDismiss() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("mailbox_alerts")
        .update({
          status: "dismissed",
        })
        .eq("id", alertId)

      if (error) {
        console.error("Failed to dismiss alert:", error.message)
        return
      }

      onOpenChange(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Dismiss Alert</DialogTitle>
          <DialogDescription>
            Are you sure you want to dismiss this alert? This will mark it as
            resolved without taking any action.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3 bg-stone-50 dark:bg-accent/50">
          <p className="text-sm font-medium">
            {alertType.replace(/_/g, " ")}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{domainName}</p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDismiss}
            disabled={loading}
          >
            {loading ? "Dismissing..." : "Dismiss Alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
