"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardList,
  Check,
  X,
  Loader2,
  PlusCircle,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** Serializable decision row (summary precomputed server-side). */
export interface DecisionRow {
  id: number
  decision_type: string
  severity: string | null
  title: string
  rationale: string | null
  summary: string
  estimated_cost_usd: number | null
  status: string
  approved_by: string | null
  approved_at: string | null
  executed_at: string | null
  error: string | null
  created_at: string
}

interface DecisionsPanelProps {
  client: string
  needsAction: DecisionRow[]
  inFlight: DecisionRow[]
  resolved: DecisionRow[]
  canApprove: boolean
  canRequestOrder: boolean
}

const SEV: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  low: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
}

function ageOf(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

export function DecisionsPanel({
  client,
  needsAction,
  inFlight,
  resolved,
  canApprove,
  canRequestOrder,
}: DecisionsPanelProps) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [denyFor, setDenyFor] = useState<DecisionRow | null>(null)
  const [denyNote, setDenyNote] = useState("")
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderNote, setOrderNote] = useState("")
  const [orderBusy, setOrderBusy] = useState(false)

  async function decide(d: DecisionRow, approve: boolean, note?: string) {
    setBusyId(d.id)
    try {
      const res = await fetch(`/api/decisions/${d.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      if (data.alreadyResolved) toast.info(data.message)
      else
        toast.success(
          approve
            ? `Approved — order placement stays a supervised step (nothing charged yet).`
            : `Dismissed — no action taken.`
        )
      setDenyFor(null)
      setDenyNote("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setBusyId(null)
    }
  }

  async function requestOrder() {
    setOrderBusy(true)
    try {
      const res = await fetch(`/api/clients/${client}/request-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: orderNote || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      if (data.deduped) toast.info(data.message)
      else
        toast.success(
          `Order request raised (#${data.id}) — approve it here or in Slack, then a supervised run places it.`
        )
      setOrderOpen(false)
      setOrderNote("")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setOrderBusy(false)
    }
  }

  const isEmpty =
    needsAction.length === 0 && inFlight.length === 0 && resolved.length === 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            Infrastructure Decisions
          </CardTitle>
          {canRequestOrder && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => setOrderOpen(true)}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Request order
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Order &amp; lifecycle decisions raised by the email-infra engines.
          Approving marks a decision ready — the actual InboxKit purchase stays
          a supervised step, so nothing is charged here.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty && (
          <p className="text-sm text-muted-foreground">
            No open infrastructure decisions for this client.
          </p>
        )}

        {/* Needs action */}
        {needsAction.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs a decision ({needsAction.length})
            </h4>
            {needsAction.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
                          SEV[d.severity ?? "low"] ?? SEV.low
                        )}
                      >
                        {d.severity ?? "info"}
                      </span>
                      <span className="text-sm font-medium">
                        {d.decision_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {ageOf(d.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{d.summary}</p>
                    {d.rationale && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {d.rationale}
                      </p>
                    )}
                    {d.estimated_cost_usd != null && (
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                        Projected cost: ${Number(d.estimated_cost_usd).toFixed(2)}{" "}
                        <span className="font-normal">(not charged on approval)</span>
                      </p>
                    )}
                  </div>
                  {canApprove && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                        disabled={busyId === d.id}
                        onClick={() => decide(d, true)}
                      >
                        {busyId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={busyId === d.id}
                        onClick={() => setDenyFor(d)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Deny
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Approved, awaiting execution */}
        {inFlight.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Approved — awaiting the supervised run ({inFlight.length})
            </h4>
            {inFlight.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium">
                    {d.decision_type.replace(/_/g, " ")}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {d.summary}
                  </span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Clock className="h-3 w-3" />
                  approved{d.approved_by ? ` · ${d.approved_by}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recent resolved (collapsed list) */}
        {resolved.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recently resolved ({resolved.length})
            </summary>
            <div className="mt-2 space-y-1">
              {resolved.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span className="min-w-0 truncate text-muted-foreground">
                    {d.decision_type.replace(/_/g, " ")} — {d.summary}
                  </span>
                  <span className="shrink-0 capitalize text-muted-foreground">
                    {d.status}
                    {d.approved_by ? ` · ${d.approved_by}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>

      {/* Deny dialog (captures an optional reason) */}
      <Dialog open={!!denyFor} onOpenChange={(o) => !o && setDenyFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny this decision?</DialogTitle>
            <DialogDescription>
              {denyFor?.decision_type.replace(/_/g, " ")} — {denyFor?.summary}.
              Denying marks it dismissed; no action is taken. Optional reason:
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[72px] w-full rounded-md border bg-background p-2 text-sm"
            placeholder="Reason (optional)"
            value={denyNote}
            onChange={(e) => setDenyNote(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDenyFor(null)}
              disabled={busyId === denyFor?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => denyFor && decide(denyFor, false, denyNote || undefined)}
              disabled={busyId === denyFor?.id}
            >
              {busyId === denyFor?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request-order dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a mailbox order</DialogTitle>
            <DialogDescription>
              Raises a pending order decision for <strong>{client}</strong>. It
              does not place or charge anything — a supervised order-engine run
              sizes the reserve-bench gap and places the InboxKit order after
              the decision is approved.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="min-h-[72px] w-full rounded-md border bg-background p-2 text-sm"
            placeholder="Context for the order (optional)"
            value={orderNote}
            onChange={(e) => setOrderNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)} disabled={orderBusy}>
              Cancel
            </Button>
            <Button onClick={requestOrder} disabled={orderBusy}>
              {orderBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Raise request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
