import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      {/* Alerts Banner placeholder */}
      <Skeleton className="h-14 w-full rounded-lg" />

      {/* KPI Cards with gradient background — 6 cards matching MetricCard layout */}
      <div className="rounded-2xl bg-gradient-to-br from-stone-50 via-white to-stone-100 dark:from-stone-900/50 dark:via-background dark:to-stone-900/30 p-6 -mx-2">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="backdrop-blur-sm bg-white/80 dark:bg-card/80 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
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

      {/* Client Summary Grid — 3 cards */}
      <div>
        <Skeleton className="mb-3 h-6 w-20" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="hover:shadow-lg transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j}>
                      <Skeleton className="h-3 w-16 mb-1" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                  ))}
                </div>
                <Skeleton className="mt-3 h-16 w-full rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Daily Send Chart + Sync Status */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <Skeleton className="mb-3 h-6 w-52" />
          <div className="rounded-lg border bg-card p-4">
            <Skeleton className="h-[250px] w-full rounded-lg" />
          </div>
        </div>
        <div className="lg:mt-9">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-24" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
              <Skeleton className="h-9 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
