"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Star, Search, ChevronDown, Droplets, Loader2 } from "lucide-react"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { healthColor, HEALTH_THRESHOLDS } from "@/lib/design-tokens"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { LifecycleStatus } from "@/lib/types"
import { MailboxActions } from "./mailbox-actions"
import { MailboxEventTimeline } from "./mailbox-event-timeline"
import type { ClientMailboxRow } from "@/lib/queries/mailboxes"

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "resting", label: "Resting" },
  { value: "ramping", label: "Ramping" },
  { value: "warming", label: "Warming" },
  { value: "reserve", label: "Reserve" },
  { value: "parked", label: "Parked" },
  { value: "burnt", label: "Burnt (needs drain)" },
  { value: "draining", label: "Draining" },
  { value: "retired", label: "Retired" },
  { value: "master", label: "Master" },
]

interface MailboxGroup {
  key: string
  label: string
  borderColor: string
  badgeColor: string
  defaultExpanded: boolean
  match: (m: ClientMailboxRow) => boolean
  sort: (a: ClientMailboxRow, b: ClientMailboxRow) => number
}

const GROUPS: MailboxGroup[] = [
  {
    key: "action-required",
    label: "Action Required",
    borderColor: "border-l-red-500",
    badgeColor: "bg-red-100 text-red-700",
    defaultExpanded: true,
    match: (m) =>
      m.lifecycle_status === "burnt" ||
      (m.warmup_health_pct != null && m.warmup_health_pct < HEALTH_THRESHOLDS.healthy
        && m.lifecycle_status !== "warming" && m.lifecycle_status !== "retired" && m.lifecycle_status !== "draining" && m.lifecycle_status !== "master"),
    sort: (a, b) => (a.warmup_health_pct ?? 0) - (b.warmup_health_pct ?? 0),
  },
  {
    key: "active",
    label: "Active",
    borderColor: "border-l-emerald-500",
    badgeColor: "bg-emerald-100 text-emerald-700",
    defaultExpanded: false,
    match: (m) =>
      m.lifecycle_status === "active" &&
      (m.warmup_health_pct == null || m.warmup_health_pct >= HEALTH_THRESHOLDS.healthy),
    sort: (a, b) => (a.warmup_health_pct ?? 100) - (b.warmup_health_pct ?? 100),
  },
  {
    key: "resting",
    label: "Resting",
    borderColor: "border-l-violet-500",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "resting",
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  {
    key: "ramping",
    label: "Ramping",
    borderColor: "border-l-blue-500",
    badgeColor: "bg-blue-100 text-blue-700",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "ramping",
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  {
    key: "reserve",
    label: "Reserve",
    borderColor: "border-l-amber-500",
    badgeColor: "bg-amber-100 text-amber-700",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "reserve",
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  {
    key: "warming",
    label: "Warming",
    borderColor: "border-l-sky-500",
    badgeColor: "bg-sky-100 text-sky-700",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "warming",
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  {
    key: "draining",
    label: "Draining",
    borderColor: "border-l-orange-500",
    badgeColor: "bg-orange-100 text-orange-700",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "draining",
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  {
    key: "retired",
    label: "Retired",
    borderColor: "border-l-gray-300",
    badgeColor: "bg-gray-100 text-gray-600",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "retired",
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  {
    key: "master",
    label: "Master",
    borderColor: "border-l-indigo-500",
    badgeColor: "bg-indigo-100 text-indigo-700",
    defaultExpanded: false,
    match: (m) => m.lifecycle_status === "master" || m.is_master_inbox,
    sort: (a, b) => a.email.localeCompare(b.email),
  },
  // Catch-all so an unrecognized lifecycle can never crash the tab
  // (sp_* vocabulary: active/resting/reserve/warming/parked/burnt/retired/master).
  {
    key: "other",
    label: "Other",
    borderColor: "border-l-stone-400",
    badgeColor: "bg-stone-100 text-stone-600 dark:bg-stone-800/60 dark:text-stone-300",
    defaultExpanded: false,
    match: () => true,
    sort: (a, b) => a.email.localeCompare(b.email),
  },
]

interface MailboxInventoryTableProps {
  mailboxes: ClientMailboxRow[]
  domainFilter?: string | null
  client?: string
}

export function MailboxInventoryTable({ mailboxes, domainFilter, client }: MailboxInventoryTableProps) {
  const router = useRouter()
  const [drainingDomains, setDrainingDomains] = useState<Set<string>>(new Set())
  const [confirmDrainDomain, setConfirmDrainDomain] = useState<{ name: string; count: number; health: number } | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [masterOnly, setMasterOnly] = useState(false)
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null)

  const toggleRow = useCallback((id: number) => {
    setExpandedRowId((prev) => (prev === id ? null : id))
  }, [])

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const g of GROUPS) {
      init[g.key] = g.defaultExpanded
    }
    return init
  })

  const filtered = useMemo(() => {
    let result = mailboxes

    if (domainFilter) {
      result = result.filter((m) => m.domain_name === domainFilter)
    }

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (m) =>
          m.email.toLowerCase().includes(q) ||
          m.domain_name.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((m) => m.lifecycle_status === statusFilter)
    }

    if (masterOnly) {
      result = result.filter((m) => m.is_master_inbox)
    }

    return result
  }, [mailboxes, domainFilter, search, statusFilter, masterOnly])

  // Group filtered mailboxes — each mailbox goes to first matching group
  const grouped = useMemo(() => {
    const result: Record<string, ClientMailboxRow[]> = {}
    for (const g of GROUPS) {
      result[g.key] = []
    }
    const assigned = new Set<number>()

    for (const g of GROUPS) {
      for (const m of filtered) {
        if (!assigned.has(m.id) && g.match(m)) {
          result[g.key].push(m)
          assigned.add(m.id)
        }
      }
      result[g.key].sort(g.sort)
    }

    // Any unmatched go to "other"
    for (const m of filtered) {
      if (!assigned.has(m.id)) {
        result["other"].push(m)
        assigned.add(m.id)
      }
    }

    return result
  }, [filtered])

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSearch = (val: string) => {
    setSearch(val)
  }
  const handleStatus = (val: string) => {
    setStatusFilter(val)
  }
  const handleMaster = () => {
    setMasterOnly((p) => !p)
  }

  // Domain sub-grouping for the Action Required section
  const actionRequiredByDomain = useMemo(() => {
    const items = grouped["action-required"] ?? []
    const domainMap = new Map<string, ClientMailboxRow[]>()
    for (const m of items) {
      const list = domainMap.get(m.domain_name) ?? []
      list.push(m)
      domainMap.set(m.domain_name, list)
    }
    return Array.from(domainMap.entries())
      .map(([domain, mbs]) => ({
        domain,
        mailboxes: mbs,
        worstHealth: Math.min(...mbs.map((m) => m.warmup_health_pct ?? 100)),
        count: mbs.length,
      }))
      .sort((a, b) => a.worstHealth - b.worstHealth)
  }, [grouped])

  // Domains that completed retire (hidden from Action Required until refresh confirms from DB)
  const [retiredDomains, setRetiredDomains] = useState<Set<string>>(new Set())

  async function pollTaskStatus(runId: string, domainName: string) {
    const maxAttempts = 20 // ~60s at 3s intervals
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const res = await fetch(`/api/tasks/status?runId=${runId}`)
        const data = await res.json()
        if (data.status === "COMPLETED") {
          setRetiredDomains((prev) => new Set(prev).add(domainName))
          setDrainingDomains((prev) => { const n = new Set(prev); n.delete(domainName); return n })
          toast.success(`${domainName} retired`, {
            description: "Sending stopped, InboxKit cancelled, catch-all set to master.",
          })
          router.refresh()
          return
        }
        if (data.status === "FAILED" || data.status === "CANCELED") {
          setDrainingDomains((prev) => { const n = new Set(prev); n.delete(domainName); return n })
          toast.error(`Failed to retire ${domainName}`, {
            description: "The domain is still active. Try again.",
          })
          return
        }
        // EXECUTING or QUEUED — keep polling
      } catch {
        // Network blip — keep trying
      }
    }
    // Timed out
    setDrainingDomains((prev) => { const n = new Set(prev); n.delete(domainName); return n })
    toast.error(`Retire timed out for ${domainName}`, {
      description: "Check the app in a minute — it may still be processing.",
    })
  }

  async function handleDrain(domainName: string) {
    if (!client) return
    setDrainingDomains((prev) => new Set(prev).add(domainName))
    toast(`Retiring ${domainName}...`, { description: "Cancelling mailboxes and setting catch-all." })
    try {
      const res = await fetch("/api/domains/drain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client, domain_name: domainName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDrainingDomains((prev) => { const n = new Set(prev); n.delete(domainName); return n })
        toast.error(data.error || "Failed to start retire")
        return
      }
      // Poll for completion in background
      pollTaskStatus(data.runId, domainName)
    } catch {
      setDrainingDomains((prev) => { const n = new Set(prev); n.delete(domainName); return n })
      toast.error("Network error")
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search email or domain..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={masterOnly ? "default" : "outline"}
          size="sm"
          onClick={handleMaster}
        >
          <Star className="mr-1.5 h-3.5 w-3.5" />
          Master Only
        </Button>
      </div>

      {/* Grouped Sections */}
      <div className="space-y-3">
        {GROUPS.map((group) => {
          const items = grouped[group.key]
          if (items.length === 0) return null
          const isExpanded = expanded[group.key]
          const isActionRequired = group.key === "action-required"

          return (
            <div
              key={group.key}
              className={cn(
                "rounded-lg border border-l-4 overflow-hidden",
                group.borderColor
              )}
            >
              {/* Section Header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className="flex w-full items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    !isExpanded && "-rotate-90"
                  )} />
                  <span className="text-sm font-medium">{group.label}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      group.badgeColor
                    )}
                  >
                    {items.length}
                  </span>
                  {isActionRequired && (
                    <span className="text-[11px] text-muted-foreground">
                      across {actionRequiredByDomain.length} domain{actionRequiredByDomain.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </button>

              {/* Section Content */}
              {isExpanded && isActionRequired ? (
                /* Domain-grouped rendering for Action Required */
                <div className="divide-y">
                  {actionRequiredByDomain
                    .filter((dg) => !retiredDomains.has(dg.domain))
                    .map((dg) => {
                    const isDraining = drainingDomains.has(dg.domain)
                    return (
                      <div key={dg.domain} className={cn(isDraining && "opacity-60")}>
                        {/* Domain header row */}
                        <div className={cn(
                          "flex items-center justify-between px-4 py-2",
                          isDraining ? "bg-gray-100/50" : "bg-rose-50/50"
                        )}>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-medium">{dg.domain}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {dg.count} mailbox{dg.count !== 1 ? "es" : ""}
                            </span>
                            {isDraining ? (
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Retiring...
                              </span>
                            ) : (
                              <span className={cn(
                                "tabular-nums text-xs font-semibold",
                                dg.worstHealth < 90 ? "text-rose-600" : "text-amber-600"
                              )}>
                                {dg.worstHealth}%
                              </span>
                            )}
                          </div>
                          {client && !isDraining && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-orange-300 px-3 text-xs text-orange-700 hover:bg-orange-50"
                              onClick={() => setConfirmDrainDomain({ name: dg.domain, count: dg.count, health: dg.worstHealth })}
                            >
                              <Droplets className="mr-1.5 h-3 w-3" />
                              Retire Domain
                            </Button>
                          )}
                        </div>
                        {/* Mailbox rows under this domain */}
                        {!isDraining && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <tbody>
                                {dg.mailboxes.map((m) => (
                                  <MailboxRow key={m.id} m={m} isExpanded={expandedRowId === m.id} onToggle={toggleRow} />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {actionRequiredByDomain.length > 0 && actionRequiredByDomain.every((dg) => retiredDomains.has(dg.domain)) && (
                    <div className="px-4 py-3 text-xs text-muted-foreground">
                      All domains retired. Refresh to see updated state.
                    </div>
                  )}
                </div>
              ) : isExpanded ? (
                /* Standard table rendering for all other groups */
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 text-left font-medium">Email</th>
                        <th className="px-3 py-2.5 text-left font-medium">Domain</th>
                        <th className="px-3 py-2.5 text-left font-medium">Status</th>
                        <th className="px-3 py-2.5 text-left font-medium">Health</th>
                        <th className="px-3 py-2.5 text-left font-medium">Platform</th>
                        <th className="px-3 py-2.5 text-right font-medium">Spam Rate</th>
                        <th className="px-3 py-2.5 text-right font-medium">Reply Rate</th>
                        <th className="px-3 py-2.5 text-center font-medium">Campaigns</th>
                        <th className="px-3 py-2.5 text-right font-medium">Daily Limit</th>
                        <th className="px-3 py-2.5 text-center font-medium">Master</th>
                        <th className="px-3 py-2.5 text-left font-medium">Tags</th>
                        <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((m) => (
                        <MailboxRow key={m.id} m={m} isExpanded={expandedRowId === m.id} onToggle={toggleRow} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="py-8 text-center text-muted-foreground rounded-lg border">
            No mailboxes match the current filters.
          </div>
        )}
      </div>

      {/* Total count */}
      <div className="text-xs text-muted-foreground">
        {filtered.length} mailbox{filtered.length !== 1 ? "es" : ""} total
      </div>

      {/* Drain confirmation dialog */}
      {confirmDrainDomain && (
        <ConfirmDialog
          open={!!confirmDrainDomain}
          onOpenChange={(v) => !v && setConfirmDrainDomain(null)}
          title={`Retire ${confirmDrainDomain.name}`}
          description={`This will immediately: set sending to 0, cancel InboxKit subscriptions (stops future billing), set catch-all forwarding to master inbox, and update tags to retired. ${confirmDrainDomain.count} mailbox${confirmDrainDomain.count !== 1 ? "es" : ""} on ${confirmDrainDomain.name} (worst health: ${confirmDrainDomain.health}%). Mailboxes remain functional until their prepaid period expires. Available reserves will be deployed to replace them.`}
          confirmLabel="Retire Domain"
          onConfirm={() => {
            const d = confirmDrainDomain
            setConfirmDrainDomain(null)
            handleDrain(d.name)
          }}
          variant="default"
        />
      )}
    </div>
  )
}

function MailboxRow({
  m,
  isExpanded,
  onToggle,
}: {
  m: ClientMailboxRow
  isExpanded: boolean
  onToggle: (id: number) => void
}) {
  const hColor = m.warmup_health_pct != null ? healthColor(m.warmup_health_pct) : null

  return (
    <>
      <tr
        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
        onClick={() => onToggle(m.id)}
      >
        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-mono text-xs">
          <div className="flex items-center gap-1">
            <ChevronDown className={cn(
              "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-200",
              !isExpanded && "-rotate-90"
            )} />
            {m.is_master_inbox && (
              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />
            )}
            <span className="truncate max-w-[180px] sm:max-w-none">{m.email}</span>
          </div>
        </td>
      <td className="px-3 py-2 text-muted-foreground">{m.domain_name}</td>
      <td className="px-3 py-2">
        <StatusBadge status={m.lifecycle_status as LifecycleStatus} />
      </td>
      <td className="px-3 py-2">
        {m.warmup_health_pct != null ? (
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  m.warmup_health_pct >= HEALTH_THRESHOLDS.healthy
                    ? "#10b981"
                    : m.warmup_health_pct >= HEALTH_THRESHOLDS.warning
                      ? "#f59e0b"
                      : "#f43f5e",
              }}
            />
            <span className={cn("tabular-nums text-xs", hColor!.text)}>
              {m.warmup_health_pct}%
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </td>
      <td className="px-3 py-2">
        {m.platform ? (
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
              m.platform.toLowerCase().includes("google")
                ? "bg-blue-50 text-blue-700"
                : "bg-sky-50 text-sky-700"
            )}
          >
            {m.platform.toLowerCase().includes("google") ? "Google" : "Microsoft"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {m.spam_rate_pct != null ? (
          <div className="flex items-center justify-end gap-1.5">
            <span
              className={cn(
                "tabular-nums text-xs font-medium",
                m.spam_rate_pct > 5
                  ? "text-red-600"
                  : m.spam_rate_pct > 2
                    ? "text-amber-600"
                    : "text-emerald-600"
              )}
            >
              {m.spam_rate_pct.toFixed(1)}%
            </span>
            {m.spam_rate_pct > 5 && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                Possible Spam
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {m.reply_rate_pct != null ? (
          <span className="tabular-nums text-xs">
            {m.reply_rate_pct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        )}
      </td>
      <td className="px-3 py-2 text-center tabular-nums">
        {m.campaign_ids?.length ?? 0}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {m.max_email_per_day ?? "--"}
      </td>
      <td className="px-3 py-2 text-center">
        {m.is_master_inbox && (
          <Star className="mx-auto h-4 w-4 text-amber-500 fill-amber-500" />
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {(m.smartlead_tags ?? []).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <MailboxActions mailbox={m} />
      </td>
    </tr>
    {isExpanded && (
      <tr className="bg-muted/20">
        <td colSpan={12} className="px-6 py-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Event Timeline
          </div>
          <MailboxEventTimeline accountId={m.id} />
        </td>
      </tr>
    )}
    </>
  )
}
