import { Skeleton } from "@/components/ui/skeleton"
import { TabSkeleton } from "@/components/clients/tab-skeletons"

/**
 * Client page loading skeleton (first navigation onto the route). Tab labels
 * mirror components/clients/client-tabs.tsx TAB_CONFIG; the body reuses the
 * SAME per-tab skeleton the in-page tab switch shows (V2 Phase 4), so the
 * route-level and tab-level loading states are one visual language.
 */
const TAB_LABELS = [
  "Overview",
  "Positive Replies",
  "Campaigns",
  "Pipelines",
  "Mailboxes",
  "Placement",
  "Alerts",
  "Settings",
]

function TabBarSkeleton() {
  return (
    <div className="flex gap-1 border-b pb-px">
      {TAB_LABELS.map((label) => (
        <Skeleton
          key={label}
          className="h-9 rounded-md"
          style={{ width: `${label.length * 9 + 24}px` }}
        />
      ))}
    </div>
  )
}

export default function ClientPageLoading() {
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

      {/* Default overview tab skeleton — same component the tab switch uses */}
      <TabSkeleton tab="overview" />
    </div>
  )
}
