"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, Suspense, useRef } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { X, Search } from "lucide-react"
import {
  CLIENTS,
  LIFECYCLE_STATUS_CONFIG,
  type LifecycleStatus,
} from "@/lib/types"

const ALL_STATUSES = Object.keys(LIFECYCLE_STATUS_CONFIG) as LifecycleStatus[]

function AccountFiltersInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = searchParams.get("search") ?? ""
  const client = searchParams.get("client") ?? ""
  const status = searchParams.get("status") ?? ""
  const platform = searchParams.get("platform") ?? ""
  const masterOnly = searchParams.get("master") === "true"
  const blockedOnly = searchParams.get("blocked") === "true"

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
      router.push(`/accounts?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateParams({ search: value || null })
      }, 300)
    },
    [updateParams]
  )

  const hasFilters =
    search || client || status || platform || masterOnly || blockedOnly

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by email or domain..."
          defaultValue={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LIFECYCLE_STATUS_CONFIG[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Platform Filter */}
        <Select
          value={platform || "all"}
          onValueChange={(v) =>
            updateParams({ platform: v === "all" ? null : v })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="Google">Google</SelectItem>
            <SelectItem value="Microsoft">Microsoft</SelectItem>
            <SelectItem value="SMTP">SMTP</SelectItem>
          </SelectContent>
        </Select>

        {/* Master Inbox Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={masterOnly}
            onCheckedChange={(checked) =>
              updateParams({ master: checked ? "true" : null })
            }
          />
          <span className="text-sm">Master only</span>
        </label>

        {/* Warmup Blocked Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={blockedOnly}
            onCheckedChange={(checked) =>
              updateParams({ blocked: checked ? "true" : null })
            }
          />
          <span className="text-sm">Blocked only</span>
        </label>

        {/* Reset Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() =>
              updateParams({
                search: null,
                client: null,
                status: null,
                platform: null,
                master: null,
                blocked: null,
              })
            }
          >
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
    </div>
  )
}

export function AccountFilters() {
  return (
    <Suspense>
      <AccountFiltersInner />
    </Suspense>
  )
}
