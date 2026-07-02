"use client"

import { useState } from "react"
import { Check, Eye, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { AlertWithDomain } from "@/lib/queries"

interface AlertsTableProps {
  unresolved: AlertWithDomain[]
  recentlyResolved: AlertWithDomain[]
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        ["critical", "high"].includes(severity)
          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
      )}
    >
      {severity}
    </span>
  )
}

export function AlertsTable({ unresolved: initialUnresolved, recentlyResolved: initialResolved }: AlertsTableProps) {
  const [unresolved, setUnresolved] = useState(initialUnresolved)
  const [resolved, setResolved] = useState(initialResolved)
  const [resolveTarget, setResolveTarget] = useState<AlertWithDomain | null>(null)
  const [resolveNotes, setResolveNotes] = useState("")
  const [showResolved, setShowResolved] = useState(false)
  const [loadingId, setLoadingId] = useState<number | null>(null)

  async function handleAcknowledge(alert: AlertWithDomain) {
    setLoadingId(alert.id)
    try {
      const res = await fetch(`/api/alerts/${alert.id}/acknowledge`, { method: "POST" })
      if (!res.ok) throw new Error("Failed to acknowledge")
      // sp_infra_alerts has no separate "dismissed" state — an ack resolves it
      const now = new Date().toISOString()
      setUnresolved((prev) => prev.filter((a) => a.id !== alert.id))
      setResolved((prev) => [
        { ...alert, status: "resolved" as const, resolved_at: now, resolution_note: "Dismissed via dashboard" },
        ...prev,
      ])
      toast.success("Alert acknowledged")
    } catch {
      toast.error("Failed to acknowledge alert")
    } finally {
      setLoadingId(null)
    }
  }

  async function handleResolve() {
    if (!resolveTarget) return
    setLoadingId(resolveTarget.id)
    try {
      const res = await fetch(`/api/alerts/${resolveTarget.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: resolveNotes || undefined }),
      })
      if (!res.ok) throw new Error("Failed to resolve")
      const now = new Date().toISOString()
      const resolvedAlert: AlertWithDomain = {
        ...resolveTarget,
        status: "resolved",
        resolved_at: now,
        resolved_by: resolveNotes || "Resolved via dashboard",
      }
      setUnresolved((prev) => prev.filter((a) => a.id !== resolveTarget.id))
      setResolved((prev) => [resolvedAlert, ...prev])
      toast.success("Alert resolved")
    } catch {
      toast.error("Failed to resolve alert")
    } finally {
      setLoadingId(null)
      setResolveTarget(null)
      setResolveNotes("")
    }
  }

  return (
    <div className="space-y-4">
      {/* Unresolved alerts table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Severity</th>
              <th className="px-4 py-3 text-left font-medium">Client</th>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {unresolved.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No unresolved alerts
                </td>
              </tr>
            ) : (
              unresolved.map((alert) => (
                <tr key={alert.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <SeverityBadge severity={alert.severity} />
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">
                    {alert.client}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{alert.title}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[250px]">
                    {alert.description ? (
                      <span className="line-clamp-1">{alert.description}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                    {timeAgo(alert.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledge(alert)}
                        disabled={loadingId === alert.id}
                        title="Acknowledge"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ack
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResolveTarget(alert)}
                        disabled={loadingId === alert.id}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Resolve
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recently Resolved collapsible section */}
      {resolved.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showResolved ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Recently Resolved ({resolved.length})
          </button>
          {showResolved && (
            <div className="mt-2 rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Severity</th>
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">Resolved</th>
                    <th className="px-4 py-3 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((alert) => (
                    <tr key={alert.id} className="border-b last:border-0 opacity-60">
                      <td className="px-4 py-3">
                        <SeverityBadge severity={alert.severity} />
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {alert.client}
                      </td>
                      <td className="px-4 py-3">{alert.title}</td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {alert.resolved_at ? timeAgo(alert.resolved_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {alert.resolved_by || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Resolve dialog with notes textarea */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => { setResolveTarget(null); setResolveNotes("") }}
          />
          <div className="relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg mx-4">
            <h2 className="text-lg font-semibold">Resolve Alert</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Resolve &ldquo;{resolveTarget.title}&rdquo;
            </p>
            <div className="py-4">
              <label htmlFor="resolve-notes" className="text-sm font-medium">
                Resolution Notes (optional)
              </label>
              <textarea
                id="resolve-notes"
                className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                placeholder="What was done to resolve this alert?"
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setResolveTarget(null); setResolveNotes("") }}
              >
                Cancel
              </Button>
              <Button onClick={handleResolve} disabled={loadingId !== null}>
                Resolve
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
