import Link from "next/link"
import { CreditCard, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  OrderStatusBadge,
  PlatformMixLabel,
  fmtUsd,
  fmtOrderDate,
} from "@/components/orders/order-bits"
import type { CockpitOrder } from "@/lib/queries/orders"

const RECENT_LIMIT = 5

/**
 * INFRA-4 (per-client scope): this client's InboxKit order history + spend.
 * Spend counts completed orders only; the global /orders page has the full
 * cross-client picture.
 */
export function ClientOrdersCard({ orders }: { orders: CockpitOrder[] }) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No infrastructure orders recorded for this client.
          </p>
          <Link
            href="/orders"
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All orders
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    )
  }

  const completed = orders.filter((o) => o.status === "completed")
  const spend = completed.reduce((s, o) => s + o.spent_usd, 0)
  const awaiting = orders.filter((o) => o.status === "awaiting_approval")
  const recent = orders.slice(0, RECENT_LIMIT)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Orders &amp; Spend
          </CardTitle>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            All orders
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{fmtUsd(spend)}</span>{" "}
          spent · {completed.length} completed order
          {completed.length !== 1 ? "s" : ""}
          {awaiting.length > 0 && (
            <>
              {" "}
              ·{" "}
              <span className="text-amber-600 dark:text-amber-400">
                {awaiting.length} awaiting approval (
                {fmtUsd(awaiting.reduce((s, o) => s + o.total_cost_usd, 0))}{" "}
                projected)
              </span>
            </>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Date</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium text-right">Boxes</th>
                <th className="pb-2 pr-4 font-medium">Platform</th>
                <th className="pb-2 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                    {fmtOrderDate(o.order_date)}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">
                    {(o.order_type ?? "order").replaceAll("_", " ")}
                  </td>
                  <td className="py-2 pr-4">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {o.mailbox_count}
                  </td>
                  <td className="py-2 pr-4">
                    <PlatformMixLabel mix={o.platform_mix} />
                  </td>
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {o.status === "completed" ? (
                      <span className="font-medium">{fmtUsd(o.spent_usd)}</span>
                    ) : o.status === "awaiting_approval" ? (
                      <span className="text-muted-foreground">
                        {fmtUsd(o.total_cost_usd)} projected
                      </span>
                    ) : (
                      <span className="text-muted-foreground">not charged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length > RECENT_LIMIT && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {RECENT_LIMIT} most recent of {orders.length} orders.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
