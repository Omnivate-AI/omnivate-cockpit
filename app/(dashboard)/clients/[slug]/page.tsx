import { notFound } from "next/navigation"
import { ClientHeader } from "@/components/clients/client-header"
import { ClientTabs } from "@/components/clients/client-tabs"
import { OverviewTab } from "@/components/clients/tabs/overview-tab"
import { CampaignsTab } from "@/components/clients/tabs/campaigns-tab"
import { MailboxesTab } from "@/components/clients/tabs/mailboxes-tab"
import { AlertsTab } from "@/components/clients/tabs/alerts-tab"
import { PipelinesTab } from "@/components/clients/tabs/pipelines-tab"
import { SettingsTab } from "@/components/clients/tabs/settings-tab"
import { PlacementTab } from "@/components/clients/tabs/placement-tab"
import { getSpClient, resolveClientSlugs } from "@/lib/queries"
import { getClientPlacementResults } from "@/lib/queries/campaigns"
import { getClientSnapshot } from "@/lib/queries/analytics"
import { createServerClient } from "@/lib/supabase/server"
import type { ClientConfig } from "@/types/analytics"

interface ClientPageProps {
  params: Promise<{ slug: string }>
}

export default async function ClientPage({ params }: ClientPageProps) {
  const { slug } = await params

  // Validate slug against sp_clients (the plugins' client registry)
  const spClient = await getSpClient(slug)
  if (!spClient) {
    notFound()
  }

  const client = slug
  const supabase = createServerClient()

  // Resolve child slugs for parent-client aggregation (e.g., roosterpunk → [roosterpunk_us, roosterpunk_uk])
  const childSlugs = await resolveClientSlugs(client)

  // Fetch shared data in parallel — all from the sp_* read-models
  const [latestSnapshot, alertCountRes, configsRes, placementResults] = await Promise.all([
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
    getClientPlacementResults(client),
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

  return (
    <div className="space-y-6">
      <ClientHeader
        clientSlug={client}
        displayName={displayName}
        latestSnapshot={latestSnapshot}
        alertCount={alertCount}
      />
      <ClientTabs
        overview={
          config ? (
            <OverviewTab
              clientSlug={client}
              latestSnapshot={latestSnapshot}
              config={config}
              alertCount={alertCount}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-8">
              No analytics configuration found for this client.
            </p>
          )
        }
        campaigns={<CampaignsTab clientSlug={client} />}
        pipelines={<PipelinesTab clientSlug={client} />}
        mailboxes={<MailboxesTab clientSlug={client} />}
        placement={<PlacementTab results={placementResults} />}
        alerts={<AlertsTab clientSlug={client} />}
        settings={
          config ? (
            <SettingsTab
              clientSlug={client}
              config={config}
              estimatedCapacity={latestSnapshot?.estimated_max_capacity ?? 0}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-8">
              No analytics configuration found for this client.
            </p>
          )
        }
      />
    </div>
  )
}
