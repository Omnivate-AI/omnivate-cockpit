import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Command Center loading skeleton — mirrors the CURRENT page layout
 * (V2 Phase 4 refresh: 4 KPI cards, range filter, portfolio strip + client
 * grid; the old 6-card + sync-panel shape predated the Phase 1 declutter).
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Title row + range filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
          <Skeleton className="mt-2 h-3 w-72" />
        </div>
        <Skeleton className="h-9 w-64 rounded-lg" />
      </div>

      {/* KPI cards in the gradient block */}
      <div className="rounded-2xl bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-stone-900/50 dark:via-background dark:to-stone-900/30 p-3 sm:p-6 -mx-1 sm:-mx-2">
        <div className="mb-2 flex justify-end">
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="backdrop-blur-sm bg-white/80 dark:bg-card/80 ring-1 ring-black/5 dark:ring-white/10 shadow-sm"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-2 h-9 w-16" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Clients heading + portfolio strip + summary grid */}
      <div>
        <Skeleton className="mb-3 h-6 w-20" />
        <Skeleton className="mb-3 h-10 w-full rounded-lg" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-2 w-full rounded" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j}>
                      <Skeleton className="h-3 w-14 mb-1" />
                      <Skeleton className="h-5 w-10" />
                    </div>
                  ))}
                </div>
                <Skeleton className="h-2 w-full rounded" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
