"use client"

import { Suspense } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CLIENTS } from "@/lib/types"

function HealthControlsInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentClient = searchParams.get("client") ?? ""
  const currentDays = searchParams.get("days") ?? "30"

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== "all") {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    const query = params.toString()
    router.push(`${pathname}${query ? `?${query}` : ""}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentClient || "all"}
        onValueChange={(val) => updateParam("client", val)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Clients" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Clients</SelectItem>
          {CLIENTS.map((c) => (
            <SelectItem key={c} value={c}>
              <span className="capitalize">{c}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentDays}
        onValueChange={(val) => updateParam("days", val)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="14">Last 14 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function HealthControls() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-3">
          <div className="h-9 w-[180px] rounded-md bg-stone-100 dark:bg-accent animate-pulse" />
          <div className="h-9 w-[130px] rounded-md bg-stone-100 dark:bg-accent animate-pulse" />
        </div>
      }
    >
      <HealthControlsInner />
    </Suspense>
  )
}
