import { Suspense } from "react"
import { notFound } from "next/navigation"
import { ClientHeader } from "@/components/clients/client-header"
import { ClientTabs } from "@/components/clients/client-tabs"
import { isTabValue, type TabValue } from "@/components/clients/tab-config"
import { TabSkeleton } from "@/components/clients/tab-skeletons"
import { EmailTab } from "@/components/clients/tabs/email-tab"
import { CombinedOverviewTab } from "@/components/clients/tabs/combined-overview-tab"
import { LinkedInTab } from "@/components/clients/tabs/linkedin-tab"
import { InterestedLeadsTab } from "@/components/clients/tabs/interested-leads-tab"
import { CampaignsTab } from "@/components/clients/tabs/campaigns-tab"
import { MailboxesTab } from "@/components/clients/tabs/mailboxes-tab"
import { AlertsTab } from "@/components/clients/tabs/alerts-tab"
import { PipelinesTab } from "@/components/clients/tabs/pipelines-tab"
import { SettingsTab } from "@/components/clients/tabs/settings-tab"
import { PlacementTab } from "@/components/clients/tabs/placement-tab"
import { getSpClient, resolveClientSlugs } from "@/lib/queries"
import { getClientSnapshot } from "@/lib/queries/analytics"
import { createServerClient } from "@/lib/supabase/server"
import type { ClientConfig } from "@/types/analytics"

interface ClientPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function ClientPage({ params, searchParams }: ClientPageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])

  // V2 Phase 4: the page renders ONLY the active tab's server component.
  // Before, all eight tabs rendered (and queried) on every request — the
  // Mailboxes tab alone fires eleven queries — so every tab click re-ran
  // ~30 queries nobody asked for (measured 2.7–4.4s to first feedback).
  const activeTab: TabValue = isTabValue(sp.tab) ? sp.tab : "overview"
  // Custom date range (Phase 4) — validated here, consumed by Overview
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : undefined
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : undefined

  // Validate slug against sp_clients (the plugins' client registry)
  const spClient = await getSpClient(slug)
  if (!spClient) {
    notFound()
  }

  const client = slug
  const supabase = createServerClient()

  // Resolve child slugs for parent-client aggregation (e.g., roosterpunk → [roosterpunk_us, roosterpunk_uk])
  const childSlugs = await resolveClientSlugs(client)

  // Shared data only (header + config) — per-tab data lives in each tab
  const [latestSnapshot, alertCountRes, configsRes] = await Promise.all([
    getClientSnapshot(client),
    supabase
      .from("vw_cockpit_alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "open")
      .in("client", childSlugs),
    supabase
      .from("client_analytics_config")
      .select("*")
      .in("client", childSlugs),
  ])

  const alertCount = alertCountRes.count ?? 0
  const childConfigs = (configsRes.data ?? []) as ClientConfig[]

  const titleize = (s: string) =>
    s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")

  // Build an aggregated config for parent clients, use the single config,
  // or fall back to defaults so the page always renders.
  let config: ClientConfig | null = null
  if (childConfigs.length === 1) {
    config = childConfigs[0]
  } else if (childConfigs.length > 1) {
    config = {
      ...childConfigs[0],
      client,
      display_name: spClient.display_name ?? titleize(client),
      parent_client: null,
      daily_email_target: childConfigs.reduce((sum, c) => sum + (c.daily_email_target ?? 0), 0),
      runway_warning_days: Math.min(...childConfigs.map((c) => c.runway_warning_days)),
      runway_critical_days: Math.min(...childConfigs.map((c) => c.runway_critical_days)),
    }
  } else {
    config = {
      id: 0,
      client,
      display_name: spClient.display_name ?? titleize(client),
      parent_client: null,
      daily_email_target: 0,
      daily_targets: null,
      lead_table: null,
      lead_filter: null,
      smartlead_client_ids: [],
      runway_warning_days: 7,
      runway_critical_days: 3,
      is_active: true,
      created_at: "",
      updated_at: "",
    }
  }
  const displayName = config?.display_name ?? spClient.display_name ?? slug

  const noConfig = (
    <p className="text-sm text-muted-foreground py-8">
      No analytics configuration found for this client.
    </p>
  )

  // Only the active tab's component is instantiated — inactive tabs run
  // ZERO queries. The Suspense fallback is the same skeleton ClientTabs
  // shows optimistically, so click → content is one continuous surface.
  function renderActiveTab(tab: TabValue) {
    switch (tab) {
      // V5 restructure: Overview = both channels; Email = the old overview
      // content, untouched; LinkedIn = the new Aimfox surface.
      case "overview":
        return (
          <CombinedOverviewTab clientSlug={client} latestSnapshot={latestSnapshot} />
        )
      case "email":
        return config ? (
          <EmailTab
            clientSlug={client}
            latestSnapshot={latestSnapshot}
            config={config}
            alertCount={alertCount}
            customFrom={from}
            customTo={to}
          />
        ) : (
          noConfig
        )
      case "linkedin":
        return <LinkedInTab clientSlug={client} />
      case "interested":
        return <InterestedLeadsTab clientSlug={client} />
      case "campaigns":
        return <CampaignsTab clientSlug={client} />
      case "pipelines":
        return <PipelinesTab clientSlug={client} />
      case "mailboxes":
        return <MailboxesTab clientSlug={client} />
      case "placement":
        return <PlacementTab clientSlug={client} />
      case "alerts":
        return <AlertsTab clientSlug={client} />
      case "settings":
        return config ? (
          <SettingsTab
            clientSlug={client}
            config={config}
            estimatedCapacity={latestSnapshot?.estimated_max_capacity ?? 0}
          />
        ) : (
          noConfig
        )
    }
  }

  return (
    <div className="space-y-6">
      <ClientHeader
        clientSlug={client}
        displayName={displayName}
        latestSnapshot={latestSnapshot}
        alertCount={alertCount}
      />
      <ClientTabs activeTab={activeTab}>
        <Suspense
          key={`${activeTab}:${from ?? ""}:${to ?? ""}`}
          fallback={<TabSkeleton tab={activeTab} />}
        >
          {renderActiveTab(activeTab)}
        </Suspense>
      </ClientTabs>
    </div>
  )
}
