"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ReactNode, useCallback, useEffect, useState, useTransition } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TabSkeleton } from "./tab-skeletons"
import { TAB_CONFIG, type TabValue } from "./tab-config"

// Type-only re-export for existing importers. The VALUES (TAB_CONFIG,
// isTabValue) live in tab-config.ts — a plain module — and must be imported
// from there: importing a function through this "use client" module hands
// the server a client reference, which throws at runtime (build stays green).
export type { TabValue } from "./tab-config"

export interface ClientTabsProps {
  /** The tab the SERVER rendered (from searchParams) — children is its content. */
  activeTab: TabValue
  /** The active tab's server-rendered content (page renders ONLY this tab). */
  children: ReactNode
}

/**
 * V2 Phase 4 — pure tab NAVIGATION. The page renders only the active tab's
 * server component (behind Suspense), so switching tabs no longer re-runs the
 * other seven tabs' queries. Feedback is instant and client-side:
 *
 *   click → pressed state flips + the target tab's skeleton renders (same
 *   frame) → router.replace kicks off the server render in a transition →
 *   the streamed content (or the page-level Suspense fallback — the SAME
 *   skeleton component) replaces it when it lands.
 *
 * Pre-Phase-4 both the pressed state and the content were derived from the
 * URL, so NOTHING moved until the full server round-trip finished — measured
 * at 2.7–4.4s on production tab clicks.
 */
export function ClientTabs({ activeTab, children }: ClientTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  // TWO optimistic states with different priorities (the <100ms trick):
  // pressedTab commits URGENTLY — its commit only re-renders the trigger
  // row, so the click paints in the next frame. skeletonTab commits inside
  // the transition — swapping a chart-heavy tab body for the skeleton
  // (recharts unmounts) costs 100-300ms, and doing it in the SAME commit as
  // the pressed flip held the paint hostage (measured 164-405ms).
  const [pressedTab, setPressedTab] = useState<TabValue | null>(null)
  const [skeletonTab, setSkeletonTab] = useState<TabValue | null>(null)

  // Server caught up → hand back to URL-derived state
  useEffect(() => {
    if (pressedTab !== null && pressedTab === activeTab) setPressedTab(null)
    if (skeletonTab !== null && skeletonTab === activeTab) setSkeletonTab(null)
  }, [pressedTab, skeletonTab, activeTab])

  const displayTab = pressedTab ?? activeTab
  const isSwitching = skeletonTab !== null && skeletonTab !== activeTab

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as TabValue
      setPressedTab(tab) // urgent: pressed state paints this frame
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "overview") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      const query = params.toString()
      startTransition(() => {
        setSkeletonTab(tab) // deferred: heavy body→skeleton swap
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        })
      })
    },
    [searchParams, router, pathname]
  )

  return (
    <Tabs value={displayTab} onValueChange={handleTabChange}>
      {/* Scrollable on narrow viewports so every tab stays reachable (NFR-4) */}
      <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <TabsList className="w-max">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {/* Keyed on CONTENT identity (skeletonTab), not the pressed tab — the
          urgent pressed-flip commit must not remount this subtree. */}
      <div role="tabpanel" className="mt-2 tab-fade-in" key={skeletonTab ?? activeTab}>
        {isSwitching ? <TabSkeleton tab={skeletonTab ?? activeTab} /> : children}
      </div>
    </Tabs>
  )
}
