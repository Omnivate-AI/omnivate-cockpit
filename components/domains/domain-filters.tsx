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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Filter } from "lucide-react"
import {
  CLIENTS,
  LIFECYCLE_STATUS_CONFIG,
  type LifecycleStatus,
} from "@/lib/types"

const ALL_STATUSES = Object.keys(LIFECYCLE_STATUS_CONFIG) as LifecycleStatus[]

function DomainFiltersInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const client = searchParams.get("client") ?? ""
  const statusParam = searchParams.get("statuses") ?? ""
  const selectedStatuses = statusParam ? statusParam.split(",") as LifecycleStatus[] : []
  const healthFilter = searchParams.get("health") ?? "all"

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
      // Reset to page 1 when filters change
      params.delete("page")
      router.push(`/domains?${params.toString()}`)
    },
    [router, searchParams]
  )

  const toggleStatus = useCallback(
    (status: LifecycleStatus) => {
      const current = new Set(selectedStatuses)
      if (current.has(status)) {
        current.delete(status)
      } else {
        current.add(status)
      }
      const value = Array.from(current).join(",")
      updateParams({ statuses: value || null })
    },
    [selectedStatuses, updateParams]
  )

  const hasFilters = client || selectedStatuses.length > 0 || healthFilter !== "all"

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Client Filter */}
      <Select
        value={client || "all"}
        onValueChange={(v) => updateParams({ client: v === "all" ? null : v })}
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

      {/* Status Multi-select */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="default" className="gap-2">
            <Filter className="h-4 w-4" />
            Status
            {selectedStatuses.length > 0 && (
              <span className="ml-1 rounded-full bg-indigo-100 dark:bg-indigo-900 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                {selectedStatuses.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-3" align="start">
          <div className="space-y-2">
            {ALL_STATUSES.map((status) => {
              const config = LIFECYCLE_STATUS_CONFIG[status]
              return (
                <label
                  key={status}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <span className={`text-sm ${config.color}`}>
                    {config.label}
                  </span>
                </label>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Health Filter */}
      <Select
        value={healthFilter}
        onValueChange={(v) =>
          updateParams({ health: v === "all" ? null : v })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Health</SelectItem>
          <SelectItem value="healthy">Healthy (95%+)</SelectItem>
          <SelectItem value="warning">Warning (85-94%)</SelectItem>
          <SelectItem value="critical">Critical (&lt;85%)</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={() =>
            updateParams({ client: null, statuses: null, health: null })
          }
        >
          <X className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  )
}

export function DomainFilters() {
  return (
    <Suspense>
      <DomainFiltersInner />
    </Suspense>
  )
}
