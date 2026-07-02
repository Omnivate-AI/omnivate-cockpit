import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      {/* Page title + Export */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-28" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Results count */}
      <Skeleton className="h-4 w-28" />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b p-4 last:border-0">
                {Array.from({ length: 7 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 w-20" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
