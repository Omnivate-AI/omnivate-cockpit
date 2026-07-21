"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { cn } from "@/lib/utils"
import { clientLabel } from "@/lib/types"

const CLIENT_DOT_COLORS: Record<string, string> = {
  roosterpunk: "bg-rose-500",
  gladlane: "bg-emerald-500",
  orbitalx: "bg-blue-500",
  valda: "bg-amber-500",
  pantheon: "bg-violet-500",
  omnivate: "bg-indigo-500",
}

function getDotColor(client: string): string {
  return CLIENT_DOT_COLORS[client] ?? "bg-teal-500"
}

interface ClientSelectorProps {
  allClients: string[]
  selected: string[]
}

export function ClientSelector({ allClients, selected }: ClientSelectorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const toggleClient = useCallback(
    (client: string) => {
      const current = new Set(selected)
      if (current.has(client)) {
        current.delete(client)
      } else {
        // No cap — Omar V4: "I want to select different clients… if I click
        // all my different clients."
        current.add(client)
      }
      const params = new URLSearchParams(searchParams.toString())
      if (current.size > 0) {
        params.set("clients", Array.from(current).join(","))
      } else {
        params.delete("clients")
      }
      router.replace(`/compare?${params.toString()}`)
    },
    [selected, searchParams, router]
  )

  return (
    <div className="flex flex-wrap gap-2">
      {allClients.map((client) => {
        const isSelected = selected.includes(client)
        return (
          <button
            key={client}
            onClick={() => toggleClient(client)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              isSelected
                ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                : "border-border bg-background text-muted-foreground hover:bg-stone-50 dark:hover:bg-accent/50"
            )}
          >
            <span
              className={cn("h-2.5 w-2.5 rounded-full", getDotColor(client))}
            />
            <span>{clientLabel(client)}</span>
            {isSelected && (
              <span className="ml-1 text-xs text-indigo-500">&#10003;</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
