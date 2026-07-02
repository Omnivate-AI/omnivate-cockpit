"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface MailboxTargetsDialogProps {
  client: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTargetDailyVolume: number | null
  initialBufferPct: number
}

export function MailboxTargetsDialog({
  client,
  open,
  onOpenChange,
  initialTargetDailyVolume,
  initialBufferPct,
}: MailboxTargetsDialogProps) {
  const router = useRouter()
  const [target, setTarget] = useState<string>(initialTargetDailyVolume?.toString() ?? "")
  const [buffer, setBuffer] = useState<string>(Math.round(initialBufferPct * 100).toString())
  const [saving, setSaving] = useState(false)

  const targetNum = target === "" ? null : parseInt(target, 10)
  const bufferNum = parseFloat(buffer) / 100
  const targetActive = targetNum !== null ? Math.ceil(targetNum / 30) : null
  const targetReserve = targetActive !== null ? Math.ceil(targetActive * bufferNum) : null

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${client}/mailbox-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          min_daily_send_volume: targetNum,
          reserve_target_pct: bufferNum,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to update targets")
        return
      }
      toast.success("Targets updated")
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mailbox Targets — {client}</DialogTitle>
          <DialogDescription>
            Set the daily sending target and reserve buffer percentage for this client.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="target" className="text-sm">
              Target daily sending volume
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="target"
                type="number"
                min="0"
                step="30"
                placeholder="e.g. 1800"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="max-w-[180px]"
              />
              <span className="text-xs text-muted-foreground">emails/day</span>
            </div>
            {targetActive !== null && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                = {targetActive} active mailboxes (at 30 emails/day per mailbox)
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="buffer" className="text-sm">
              Reserve buffer percentage
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="buffer"
                type="number"
                min="0"
                max="200"
                step="5"
                value={buffer}
                onChange={(e) => setBuffer(e.target.value)}
                className="max-w-[120px]"
              />
              <span className="text-xs text-muted-foreground">%  (default 50%)</span>
            </div>
            {targetReserve !== null && targetActive !== null && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                = {targetReserve} reserve mailboxes to keep ready
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || target === ""}>
            {saving ? "Saving…" : "Save Targets"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
