import { Skeleton } from "@/components/ui/skeleton"

export default function OnboardingLoading() {
  return (
    <div className="space-y-8">
      {/* Page title */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      {/* Step indicator skeleton */}
      <div className="flex items-center justify-between px-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            {i < 4 && <Skeleton className="mx-3 mt-[-1.5rem] h-0.5 flex-1" />}
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="flex flex-col items-center justify-center py-16">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Navigation buttons skeleton */}
      <div className="flex items-center justify-between border-t border-stone-200 dark:border-stone-700 pt-6">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  )
}
