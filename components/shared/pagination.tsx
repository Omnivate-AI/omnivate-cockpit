"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  totalCount: number
  pageSize: number
  basePath: string
}

function PaginationInner({ totalCount, pageSize, basePath }: PaginationProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentPage = Number(searchParams.get("page") ?? "1")
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page <= 1) {
        params.delete("page")
      } else {
        params.set("page", String(page))
      }
      router.push(`${basePath}?${params.toString()}`)
    },
    [router, searchParams, basePath]
  )

  if (totalPages <= 1) return null

  // Generate page numbers to show
  const pages: (number | "ellipsis")[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis")
    }
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)}–
        {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="px-2 text-sm text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function Pagination(props: PaginationProps) {
  return (
    <Suspense>
      <PaginationInner {...props} />
    </Suspense>
  )
}
