"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, Suspense } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortableHeaderProps {
  column: string
  label: string
  className?: string
  basePath: string
}

function SortableHeaderInner({
  column,
  label,
  className,
  basePath,
}: SortableHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentSort = searchParams.get("sort") ?? ""
  const currentDir = searchParams.get("dir") ?? "asc"
  const isActive = currentSort === column

  const handleSort = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (isActive) {
      // Toggle direction
      params.set("dir", currentDir === "asc" ? "desc" : "asc")
    } else {
      params.set("sort", column)
      params.set("dir", "asc")
    }
    params.delete("page")
    router.push(`${basePath}?${params.toString()}`)
  }, [router, searchParams, column, isActive, currentDir, basePath])

  const Icon = isActive
    ? currentDir === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown

  return (
    <button
      onClick={handleSort}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {label}
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

export function SortableHeader(props: SortableHeaderProps) {
  return (
    <Suspense>
      <SortableHeaderInner {...props} />
    </Suspense>
  )
}
