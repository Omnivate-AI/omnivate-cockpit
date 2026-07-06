"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, Suspense } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface AlertFiltersInnerProps {
  clients: string[]
  alertTypes: string[]
}

function AlertFiltersInner({ clients, alertTypes }: AlertFiltersInnerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const severity = searchParams.get("severity") ?? ""
  const client = searchParams.get("client") ?? ""
  const status = searchParams.get("status") ?? ""
  const alertType = searchParams.get("alert_type") ?? ""
  // Absent = the actionable default (Omar 07-06 alert rebuild)
  const tier = searchParams.get("tier") ?? "actionable"

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      params.delete("page")
      router.push(`/alerts?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasFilters =
    severity || client || status || alertType || tier !== "actionable"

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Tier Filter — actionable is the trusted default; maintenance is
          the self-healing/cleanup noise, opt-in only */}
      <Select
        value={tier}
        onValueChange={(v) =>
          updateParams({ tier: v === "actionable" ? null : v })
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Actionable" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="actionable">Actionable</SelectItem>
          <SelectItem value="maintenance">Maintenance</SelectItem>
          <SelectItem value="all">All Tiers</SelectItem>
        </SelectContent>
      </Select>

      {/* Severity Filter */}
      <Select
        value={severity || "all"}
        onValueChange={(v) =>
          updateParams({ severity: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Severities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      {/* Client Filter */}
      <Select
        value={client || "all"}
        onValueChange={(v) =>
          updateParams({ client: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {clients.map((c) => (
            <SelectItem key={c} value={c} className="capitalize">
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={status || "unresolved"}
        onValueChange={(v) =>
          updateParams({ status: v === "unresolved" ? null : v })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Unresolved" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unresolved">Unresolved</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
        </SelectContent>
      </Select>

      {/* Alert Type Filter */}
      {alertTypes.length > 0 && (
        <Select
          value={alertType || "all"}
          onValueChange={(v) =>
            updateParams({ alert_type: v === "all" ? null : v })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {alertTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Reset Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() =>
            updateParams({
              severity: null,
              client: null,
              status: null,
              alert_type: null,
              tier: null,
            })
          }
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  )
}

interface AlertFiltersProps {
  clients: string[]
  alertTypes: string[]
}

export function AlertFilters({ clients, alertTypes }: AlertFiltersProps) {
  return (
    <Suspense>
      <AlertFiltersInner clients={clients} alertTypes={alertTypes} />
    </Suspense>
  )
}
