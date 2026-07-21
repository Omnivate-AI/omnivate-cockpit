import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { clientLabel } from "@/lib/types"
import { COMPARE_METRICS } from "@/lib/compare-metrics"
import type { CompareStatRow } from "@/lib/queries/analytics"

/**
 * V4 E1 — one panel per selected parameter, each a horizontal-bar comparison
 * across the selected clients. Server-rendered (no chart runtime needed);
 * bars scale to the panel's max value. Ratio panels flag "lower is better"
 * so a long bar isn't misread as a win.
 */

// Matches the sidebar/compare line colors app-wide.
const CLIENT_BAR_COLORS: Record<string, string> = {
  roosterpunk: "bg-rose-500",
  gladlane: "bg-emerald-500",
  orbitalx: "bg-blue-500",
  valda: "bg-amber-500",
  pantheon: "bg-violet-500",
  omnivate: "bg-indigo-500",
  cylindo: "bg-cyan-500",
  paycaptain: "bg-teal-500",
  acceleration_partners: "bg-fuchsia-500",
}

function barColor(client: string): string {
  return CLIENT_BAR_COLORS[client] ?? "bg-stone-400"
}

export function ComparePanels({
  stats,
  metricKeys,
  rangeLabel,
}: {
  stats: CompareStatRow[]
  metricKeys: string[]
  rangeLabel: string
}) {
  const metrics = COMPARE_METRICS.filter((m) => metricKeys.includes(m.key))
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {metrics.map((m) => {
        const values = stats.map((s) => ({ client: s.client, value: m.value(s) }))
        const max = Math.max(0, ...values.map((v) => v.value ?? 0))
        return (
          <Card key={m.key}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-medium">
                  {m.label} — {rangeLabel}
                </CardTitle>
                {m.lowerIsBetter && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    lower is better
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{m.help}</p>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {values.map(({ client, value }) => (
                <div key={client} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs font-medium">
                    {clientLabel(client)}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                    {value != null && max > 0 && (
                      <div
                        className={`h-full rounded ${barColor(client)}`}
                        style={{ width: `${Math.max(2, (value / max) * 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">
                    {value != null ? m.format(value) : "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
