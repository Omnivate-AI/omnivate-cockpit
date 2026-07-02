import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import type { PlacementTestResult } from "@/lib/queries/campaigns"

interface SpamRiskBannerProps {
  risks: PlacementTestResult[]
}

export function SpamRiskBanner({ risks }: SpamRiskBannerProps) {
  if (risks.length === 0) return null

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
          Spam Risk ({risks.length})
        </span>
      </div>
      <ul className="space-y-2">
        {risks.map((r) => {
          const isHigh = (r.spam_pct ?? 0) > 20
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isHigh
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                  }`}
                >
                  {(r.spam_pct ?? 0).toFixed(0)}% spam
                </span>
                <span className="font-medium text-foreground truncate">
                  {r.client}
                </span>
                <span className="text-muted-foreground truncate">
                  {r.campaign_name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {r.test_date}
                </span>
              </div>
              <Link
                href={`/clients/${r.client}?tab=placement`}
                className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
              >
                View
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
