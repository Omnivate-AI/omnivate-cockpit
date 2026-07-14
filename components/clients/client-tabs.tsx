"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ReactNode, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

const TAB_CONFIG = [
  { value: "overview", label: "Overview" },
  { value: "interested", label: "Positive Replies" },
  { value: "campaigns", label: "Campaigns" },
  { value: "pipelines", label: "Pipelines" },
  { value: "mailboxes", label: "Mailboxes" },
  { value: "placement", label: "Placement" },
  { value: "alerts", label: "Alerts" },
  { value: "settings", label: "Settings" },
] as const

export type TabValue = (typeof TAB_CONFIG)[number]["value"]

export interface ClientTabsProps {
  overview?: ReactNode
  interested?: ReactNode
  campaigns?: ReactNode
  pipelines?: ReactNode
  mailboxes?: ReactNode
  placement?: ReactNode
  alerts?: ReactNode
  settings?: ReactNode
}

export function ClientTabs({
  overview,
  interested,
  campaigns,
  pipelines,
  mailboxes,
  placement,
  alerts,
  settings,
}: ClientTabsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = (searchParams.get("tab") as TabValue) || "overview"

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === "overview") {
        params.delete("tab")
      } else {
        params.set("tab", value)
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname)
    },
    [searchParams, router, pathname]
  )

  const tabContent: Record<TabValue, ReactNode> = {
    overview: overview ?? <p className="text-sm text-muted-foreground py-8">Overview tab content coming soon</p>,
    interested: interested ?? <p className="text-sm text-muted-foreground py-8">Interested leads content coming soon</p>,
    campaigns: campaigns ?? <p className="text-sm text-muted-foreground py-8">Campaigns tab content coming soon</p>,
    pipelines: pipelines ?? <p className="text-sm text-muted-foreground py-8">Pipelines tab content coming soon</p>,
    mailboxes: mailboxes ?? <p className="text-sm text-muted-foreground py-8">Mailboxes tab content coming soon</p>,
    placement: placement ?? <p className="text-sm text-muted-foreground py-8">Placement tab content coming soon</p>,
    alerts: alerts ?? <p className="text-sm text-muted-foreground py-8">Alerts tab content coming soon</p>,
    settings: settings ?? <p className="text-sm text-muted-foreground py-8">Settings tab content coming soon</p>,
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
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
      {TAB_CONFIG.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="tab-fade-in">
          {tabContent[tab.value]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
