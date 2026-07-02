"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Droplets,
  Loader2,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { BurntDomainRow } from "@/lib/queries/mailboxes"

interface BurntDomainsListProps {
  domains: BurntDomainRow[]
  client: string
}

function daysSince(iso: string | null): string {
  if (!iso) return "?"
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days === 0) return "today"
  if (days === 1) return "1d ago"
  return `${days}d ago`
}

export function BurntDomainsList({ domains, client }: BurntDomainsListProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draining, setDraining] = useState<Set<string>>(new Set())
  const [confirmDomain, setConfirmDomain] = useState<BurntDomainRow | null>(null)

  if (domains.length === 0) {
    return (
      <Card>
        <CardContent className="px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">No burnt domains</span>
            <span className="text-xs text-muted-foreground">
              — everything is healthy
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalMailboxes = domains.reduce((s, d) => s + d.mailbox_count, 0)

  async function handleDrain(domain: BurntDomainRow) {
    setDraining((prev) => new Set(prev).add(domain.domain_name))
    try {
      const res = await fetch("/api/domains/drain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          domain_name: domain.domain_name,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Failed to start drain")
        return
      }
      toast.success(`Drain started for ${domain.domain_name}`, {
        description: `Task run: ${data.runId}. Sending set to 0.`,
      })
      router.refresh()
    } catch {
      toast.error("Network error — could not reach the server")
    } finally {
      setDraining((prev) => {
        const next = new Set(prev)
        next.delete(domain.domain_name)
        return next
      })
    }
  }

  return (
    <>
      <Card className="border-rose-200">
        <CardContent className="px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              {open ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <AlertCircle className="h-4 w-4 text-rose-600" />
              <span className="text-sm font-medium">
                Burnt domains awaiting action ({domains.length})
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {totalMailboxes} mailbox{totalMailboxes !== 1 ? "es" : ""}{" "}
              affected
            </span>
          </button>

          {open && (
            <div className="mt-3 space-y-1 border-t pt-3">
              {domains.map((d) => {
                const isDraining = draining.has(d.domain_name)
                return (
                  <div
                    key={d.domain_name}
                    className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-mono truncate">
                        {d.domain_name}
                      </span>
                      <span className="text-muted-foreground">
                        ({d.mailbox_count} mailbox
                        {d.mailbox_count !== 1 ? "es" : ""})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {d.latest_warmup_health !== null && (
                        <span
                          className={cn(
                            "tabular-nums font-medium",
                            d.latest_warmup_health < 90
                              ? "text-rose-600"
                              : d.latest_warmup_health < 97
                                ? "text-amber-600"
                                : "text-emerald-600"
                          )}
                        >
                          {d.latest_warmup_health}%
                        </span>
                      )}
                      <span className="text-[10px]">
                        {daysSince(d.burn_detected_at)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 border-orange-300 px-2 text-[11px] text-orange-700 hover:bg-orange-50"
                        disabled={isDraining}
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDomain(d)
                        }}
                      >
                        {isDraining ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Droplets className="mr-1 h-3 w-3" />
                        )}
                        Drain
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {confirmDomain && (
        <ConfirmDialog
          open={!!confirmDomain}
          onOpenChange={(v) => !v && setConfirmDomain(null)}
          title={`Drain ${confirmDomain.domain_name}`}
          description={`This will set sending to 0 on all ${confirmDomain.mailbox_count} mailbox${confirmDomain.mailbox_count !== 1 ? "es" : ""} on ${confirmDomain.domain_name} (health: ${confirmDomain.latest_warmup_health}%). They will stay in campaigns for reply matching. Available reserves will be deployed to replace them.`}
          confirmLabel="Start Drain"
          onConfirm={() => {
            const d = confirmDomain
            setConfirmDomain(null)
            handleDrain(d)
          }}
          variant="default"
        />
      )}
    </>
  )
}
