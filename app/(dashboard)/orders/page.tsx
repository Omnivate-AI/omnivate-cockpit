import Link from "next/link"
import {
  CreditCard,
  Inbox,
  Globe,
  Hourglass,
  PackageOpen,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MetricCard } from "@/components/shared/metric-card"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { getOrders, type CockpitOrder } from "@/lib/queries/orders"
import { OrderStatusBadge, PlatformMixLabel, fmtUsd, fmtOrderDate } from "@/components/orders/order-bits"
import { clientLabel } from "@/lib/types"
import { cn } from "@/lib/utils"

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "30d", label: "Last 30 Days", days: 30 },
  { key: "90d", label: "Last 90 Days", days: 90 },
  { key: "all", label: "All Time", days: null },
]

interface OrdersPageProps {
  searchParams: Promise<{ range?: string }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams
  const rangeKey = RANGES.some((r) => r.key === params.range)
    ? (params.range as string)
    : "all"
  const range = RANGES.find((r) => r.key === rangeKey)!

  const allOrders = await getOrders()

  const cutoff =
    range.days !== null
      ? new Date(Date.now() - range.days * 86_400_000).toISOString()
      : null
  const orders = cutoff
    ? allOrders.filter((o) => o.order_date >= cutoff)
    : allOrders

  const completed = orders.filter((o) => o.status === "completed")
  const awaiting = orders.filter((o) => o.status === "awaiting_approval")
  const totalSpend = completed.reduce((s, o) => s + o.spent_usd, 0)
  const mailboxesPurchased = completed.reduce((s, o) => s + o.mailbox_count, 0)
  const domainsPurchased = completed.reduce((s, o) => s + o.domain_count, 0)
  const awaitingProjected = awaiting.reduce((s, o) => s + o.total_cost_usd, 0)

  // Per-client rollup (completed = spend truth; awaiting shown as projected)
  const byClient = new Map<
    string,
    { spend: number; orders: number; domains: number; mailboxes: number; awaitingUsd: number; lastCompleted: string | null }
  >()
  for (const o of orders) {
    const e =
      byClient.get(o.client) ??
      { spend: 0, orders: 0, domains: 0, mailboxes: 0, awaitingUsd: 0, lastCompleted: null }
    if (o.status === "completed") {
      e.spend += o.spent_usd
      e.orders += 1
      e.domains += o.domain_count
      e.mailboxes += o.mailbox_count
      if (o.completed_at && (!e.lastCompleted || o.completed_at > e.lastCompleted)) {
        e.lastCompleted = o.completed_at
      }
    } else if (o.status === "awaiting_approval") {
      e.awaitingUsd += o.total_cost_usd
    }
    byClient.set(o.client, e)
  }
  const clientRows = Array.from(byClient.entries()).sort(
    (a, b) => b[1].spend - a[1].spend
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Orders &amp; Spend
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            InboxKit infrastructure orders — spend counts completed orders only
          </p>
          <SectionFreshness mode="db" prefix="Live orders" className="mt-1.5" />
        </div>
        {/* Range selector */}
        <div className="flex gap-1 rounded-lg border bg-card p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={r.key === "all" ? "/orders" : `/orders?range=${r.key}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                r.key === rangeKey
                  ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Spend KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={`Spend (${range.label})`}
          value={fmtUsd(totalSpend)}
          icon={CreditCard}
        />
        <MetricCard
          title="Mailboxes Purchased"
          value={mailboxesPurchased.toLocaleString()}
          icon={Inbox}
        />
        <MetricCard
          title="Domains Purchased"
          value={domainsPurchased.toLocaleString()}
          icon={Globe}
        />
        <MetricCard
          title="Awaiting Approval"
          value={
            awaiting.length > 0
              ? `${awaiting.length} · ${fmtUsd(awaitingProjected)}`
              : "None"
          }
          icon={Hourglass}
          valueColor={awaiting.length > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
      </div>

      {/* Per-client spend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spend by Client</CardTitle>
        </CardHeader>
        <CardContent>
          {clientRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No orders in this range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Client</th>
                    <th className="pb-2 pr-4 font-medium text-right">Completed Orders</th>
                    <th className="pb-2 pr-4 font-medium text-right">Domains</th>
                    <th className="pb-2 pr-4 font-medium text-right">Mailboxes</th>
                    <th className="pb-2 pr-4 font-medium text-right">Spend</th>
                    <th className="pb-2 font-medium text-right">Pending Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {clientRows.map(([client, e]) => (
                    <tr key={client} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">
                        <Link
                          href={`/clients/${client}?tab=mailboxes`}
                          className="hover:underline"
                        >
                          {clientLabel(client)}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{e.orders}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{e.domains}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{e.mailboxes}</td>
                      <td className="py-2.5 pr-4 text-right font-medium tabular-nums">
                        {fmtUsd(e.spend)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                        {e.awaitingUsd > 0 ? `${fmtUsd(e.awaitingUsd)} projected` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Orders ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No orders in this range"
              description="Try a wider date range — infrastructure orders are placed via the email-infra plugin."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Client</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Domains</th>
                    <th className="pb-2 pr-4 font-medium text-right">Mailboxes</th>
                    <th className="pb-2 pr-4 font-medium">Platform</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <OrderRow key={o.id} order={o} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function OrderRow({ order }: { order: CockpitOrder }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">
        {fmtOrderDate(order.order_date)}
      </td>
      <td className="py-2.5 pr-4 font-medium">{clientLabel(order.client)}</td>
      <td className="py-2.5 pr-4 text-muted-foreground">
        {(order.order_type ?? "order").replaceAll("_", " ")}
      </td>
      <td className="py-2.5 pr-4">
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{order.domain_count}</td>
      <td className="py-2.5 pr-4 text-right tabular-nums">{order.mailbox_count}</td>
      <td className="py-2.5 pr-4">
        <PlatformMixLabel mix={order.platform_mix} />
      </td>
      <td className="py-2.5 text-right tabular-nums whitespace-nowrap">
        {order.status === "completed" ? (
          <span className="font-medium">{fmtUsd(order.spent_usd)}</span>
        ) : order.status === "awaiting_approval" ? (
          <span className="text-muted-foreground">
            {fmtUsd(order.total_cost_usd)} projected
          </span>
        ) : (
          <span className="text-muted-foreground">$0 · not charged</span>
        )}
      </td>
    </tr>
  )
}
