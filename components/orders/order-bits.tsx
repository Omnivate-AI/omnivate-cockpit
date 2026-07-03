import { cn } from "@/lib/utils"
import { normalizePlatformMix } from "@/lib/queries/orders"

// Shared display atoms for InboxKit orders (global /orders page + the
// per-client Orders & Spend card). Pure/presentational — server-safe.

const STATUS_STYLES: Record<string, string> = {
  completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  awaiting_approval:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  superseded:
    "bg-stone-100 text-stone-600 dark:bg-stone-800/60 dark:text-stone-400",
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  awaiting_approval: "Awaiting Approval",
  failed: "Failed",
  superseded: "Superseded",
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.superseded
      )}
    >
      {STATUS_LABELS[status] ?? status.replaceAll("_", " ")}
    </span>
  )
}

const PLATFORM_SHORT: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  smtp: "SMTP",
}

export function PlatformMixLabel({
  mix,
}: {
  mix: Record<string, number> | null
}) {
  const normalized = normalizePlatformMix(mix)
  const parts = Object.entries(normalized)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${v} ${PLATFORM_SHORT[k] ?? k}`)
  if (parts.length === 0)
    return <span className="text-muted-foreground">—</span>
  return <span className="whitespace-nowrap text-xs">{parts.join(" · ")}</span>
}

export function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** "17 Jun 2026" — deterministic UTC rendering. */
export function fmtOrderDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
