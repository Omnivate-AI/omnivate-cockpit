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
import { CLIENTS } from "@/lib/types"

function AuditFiltersInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const actionType = searchParams.get("action") ?? ""
  const client = searchParams.get("client") ?? ""
  const status = searchParams.get("status") ?? ""
  const dateRange = searchParams.get("range") ?? ""

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
      router.push(`/audit?${params.toString()}`)
    },
    [router, searchParams]
  )

  const hasFilters = actionType || client || status || dateRange

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Action Type Filter */}
      <Select
        value={actionType || "all"}
        onValueChange={(v) =>
          updateParams({ action: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Actions</SelectItem>
          <SelectItem value="rotate_burnt">Rotate Burnt</SelectItem>
          <SelectItem value="set_master_inbox">Set Master Inbox</SelectItem>
          <SelectItem value="health_update">Health Update</SelectItem>
          <SelectItem value="tag_change">Tag Change</SelectItem>
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
          {CLIENTS.map((c) => (
            <SelectItem key={c} value={c} className="capitalize">
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={status || "all"}
        onValueChange={(v) =>
          updateParams({ status: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range Filter */}
      <Select
        value={dateRange || "all"}
        onValueChange={(v) =>
          updateParams({ range: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Time" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() =>
            updateParams({
              action: null,
              client: null,
              status: null,
              range: null,
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

export function AuditFilters() {
  return (
    <Suspense>
      <AuditFiltersInner />
    </Suspense>
  )
}
