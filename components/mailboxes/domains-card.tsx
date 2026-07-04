import { Globe, ShieldAlert, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ClientDomainRow } from "@/lib/queries/clients"

const LIFECYCLE_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  resting: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  reserve: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  warming: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
  parked: "bg-stone-100 text-stone-600 dark:bg-stone-800/60 dark:text-stone-400",
  burnt: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
  retired: "bg-gray-100 text-gray-500 dark:bg-gray-800/60 dark:text-gray-400",
  master: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400",
}

interface DomainsCardProps {
  domains: ClientDomainRow[]
  /** domain → blacklist status (listed | clean | couldnt_check) */
  blacklistByDomain: Record<string, string>
  /** domains hosting a master inbox */
  masterDomains: string[]
}

/**
 * INFRA-3: the client's domains with mailbox counts, lifecycle, catch-all
 * and master status, health, and DNSBL state — one row per domain.
 */
export function DomainsCard({
  domains,
  blacklistByDomain,
  masterDomains,
}: DomainsCardProps) {
  if (domains.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No domains tracked for this client yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  const masters = new Set(masterDomains)
  const sorted = [...domains].sort((a, b) => {
    const aM = masters.has(a.domain_name) ? 0 : 1
    const bM = masters.has(b.domain_name) ? 0 : 1
    if (aM !== bM) return aM - bM
    return a.domain_name.localeCompare(b.domain_name)
  })
  const catchAllCount = domains.filter((d) => d.catch_all_email).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Domains ({domains.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {catchAllCount} of {domains.length} with catch-all forwarding
          configured
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Domain</th>
                <th className="px-3 py-2 font-medium text-right">Boxes</th>
                <th className="px-3 py-2 font-medium">Lifecycle</th>
                <th className="px-3 py-2 font-medium">Catch-all</th>
                <th className="px-3 py-2 font-medium text-right">Warmup</th>
                <th className="px-3 py-2 font-medium">Blacklist</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => {
                const bl = blacklistByDomain[d.domain_name]
                const health = d.latest_warmup_health ?? d.warmup_health_avg
                return (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">
                      <span className="flex items-center gap-2">
                        {d.domain_name}
                        {masters.has(d.domain_name) && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              LIFECYCLE_STYLES.master
                            )}
                          >
                            MASTER
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d.account_count}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          LIFECYCLE_STYLES[d.lifecycle_status] ??
                            LIFECYCLE_STYLES.parked
                        )}
                      >
                        {d.lifecycle_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {d.catch_all_email ? (
                        <span title={d.catch_all_email}>✓ configured</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums",
                        health !== null && Number(health) < 97
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {health !== null ? `${Number(health).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {bl === "listed" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Listed
                        </span>
                      ) : bl === "clean" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Clean
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {bl === "couldnt_check" ? "Unreachable" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
