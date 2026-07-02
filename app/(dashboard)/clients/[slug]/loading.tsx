import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

function TabBarSkeleton() {
  return (
    <div className="flex gap-1 border-b pb-px">
      {["Overview", "Campaigns", "Pipelines", "Mailboxes", "Placement", "Alerts", "Settings"].map(
        (label) => (
          <Skeleton key={label} className="h-9 rounded-md" style={{ width: `${label.length * 9 + 24}px` }} />
        )
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Performance metrics toggle + cards */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-md" />
        ))}
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-14" />
              <Skeleton className="mt-1 h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI metric cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="backdrop-blur-sm bg-white/80 dark:bg-card/80 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-9 w-14" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-36" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      {/* Anomaly callouts + runway */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-5 w-28 mb-4" />
            <Skeleton className="h-24 w-full rounded" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ClientDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Client Header skeleton — matches sticky header */}
      <div className="rounded-xl p-5 bg-gradient-to-r from-stone-50 to-stone-100 dark:from-stone-900/50 dark:to-stone-900/30">
        <Skeleton className="h-3 w-36 mb-3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="mt-3 flex gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <TabBarSkeleton />

      {/* Default overview tab skeleton */}
      <OverviewSkeleton />
    </div>
  )
}
