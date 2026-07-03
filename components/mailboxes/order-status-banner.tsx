"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Loader2, Check, AlertTriangle, Package } from "lucide-react"

interface OrderSummary {
  id: number
  status: string
  domain_count: number
  mailbox_count: number
  total_cost_usd: number
  placed_at: string | null
  completed_at: string | null
  monitoring_task_run_id: string | null
  selected_domains: Array<{ name: string; persona: string; platform: string }>
}

interface ProvisioningStatus {
  total_mailboxes: number
  by_status: Record<string, number>
  domains_ready: number
  domains_total: number
  in_supabase: number
}

interface OrderStatusBannerProps {
  client: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function personaBreakdown(
  domains: Array<{ name: string; persona: string; platform: string }>
): string {
  const grouped: Record<string, Record<string, number>> = {}
  for (const d of domains) {
    const p = d.persona || "unknown"
    if (!grouped[p]) grouped[p] = {}
    const plat = (d.platform || "unknown").replace("GOOGLE", "Google").replace("MICROSOFT", "Microsoft")
    grouped[p][plat] = (grouped[p][plat] || 0) + 1
  }
  return Object.entries(grouped)
    .map(([persona, platforms]) => {
      const parts = Object.entries(platforms).map(([plat, count]) => `${count} ${plat}`)
      return `${persona} (${parts.join(", ")})`
    })
    .join(" \u00b7 ")
}

function isWithin24Hours(dateStr: string | null): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
}

export function OrderStatusBanner({ client }: OrderStatusBannerProps) {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [provisioningData, setProvisioningData] = useState<Record<number, ProvisioningStatus>>({})

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${client}/orders`)
      if (!res.ok) return
      const data: OrderSummary[] = await res.json()
      setOrders(data)
    } catch {
      // silent
    }
  }, [client])

  // Poll orders
  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 15_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  // Poll provisioning status for active orders
  const activeOrders = orders.filter(
    (o) => o.status === "placed" && !o.completed_at && isWithin24Hours(o.placed_at)
  )

  useEffect(() => {
    if (activeOrders.length === 0) return

    const pollProvisioning = async () => {
      for (const order of activeOrders) {
        try {
          const res = await fetch(
            `/api/clients/${client}/orders/${order.id}/provisioning-status`
          )
          if (!res.ok) continue
          const data: ProvisioningStatus = await res.json()
          setProvisioningData((prev) => ({ ...prev, [order.id]: data }))
        } catch {
          // silent
        }
      }
    }

    pollProvisioning()
    const interval = setInterval(pollProvisioning, 30_000)
    return () => clearInterval(interval)
  }, [activeOrders.length, client]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recently completed (within 2 hours)
  const completedOrders = orders.filter(
    (o) =>
      (o.status === "completed" || (o.status === "placed" && o.completed_at)) &&
      o.completed_at &&
      Date.now() - new Date(o.completed_at).getTime() < 2 * 60 * 60 * 1000
  )

  if (activeOrders.length === 0 && completedOrders.length === 0) return null

  return (
    <div className="space-y-2">
      {/* Completed — compact one-liner */}
      {completedOrders.map((order) => (
        <div
          key={order.id}
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30 px-4 py-2"
        >
          <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span className="text-xs text-emerald-700">
            Order #{order.id} complete — {order.mailbox_count} mailboxes warming
          </span>
          <span className="text-xs text-muted-foreground ml-auto">
            {order.completed_at ? timeAgo(order.completed_at) : ""}
          </span>
        </div>
      ))}

      {/* Active — full card with progress */}
      {activeOrders.map((order) => {
        const prov = provisioningData[order.id]
        const personaText = personaBreakdown(order.selected_domains)
        const progressPct = prov
          ? Math.round((prov.domains_ready / Math.max(prov.domains_total, 1)) * 100)
          : 0

        return (
          <Card key={order.id} className="border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30">
            <CardContent className="py-3 px-4 space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-medium">
                    Order #{order.id} — {order.domain_count} domain
                    {order.domain_count !== 1 ? "s" : ""},{" "}
                    {order.mailbox_count} mailbox
                    {order.mailbox_count !== 1 ? "es" : ""}
                  </span>
                  {order.placed_at && (
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(order.placed_at)}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  ${order.total_cost_usd.toFixed(2)}
                </span>
              </div>

              {/* Progress bar */}
              {prov && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-blue-100 dark:bg-blue-950/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-blue-700 tabular-nums w-24 text-right">
                      {prov.domains_ready}/{prov.domains_total} domains
                    </span>
                  </div>

                  {/* Status breakdown */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {Object.entries(prov.by_status).map(([status, count]) => (
                      <span key={status} className="flex items-center gap-1">
                        {status === "active" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}
                        {status === "processing" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        )}
                        {status === "scheduled" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        )}
                        {status === "configuring_auth" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        )}
                        {count} {status.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* No provisioning data yet — just show spinner */}
              {!prov && (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/50"
                >
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking provisioning status...
                </Badge>
              )}

              {/* Persona breakdown */}
              {personaText && (
                <p className="text-xs text-muted-foreground">{personaText}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
