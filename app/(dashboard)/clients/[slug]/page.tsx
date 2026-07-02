import { notFound } from "next/navigation"
import Link from "next/link"
import { Loader2, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ClientHeader } from "@/components/clients/client-header"
import { ClientTabs } from "@/components/clients/client-tabs"
import { OverviewTab } from "@/components/clients/tabs/overview-tab"
import { CampaignsTab } from "@/components/clients/tabs/campaigns-tab"
import { MailboxesTab } from "@/components/clients/tabs/mailboxes-tab"
import { AlertsTab } from "@/components/clients/tabs/alerts-tab"
import { PipelinesTab } from "@/components/clients/tabs/pipelines-tab"
import { SettingsTab } from "@/components/clients/tabs/settings-tab"
import { PlacementTab } from "@/components/clients/tabs/placement-tab"
import { getSetupBySlug, resolveClientSlugs } from "@/lib/queries"
import { getClientPlacementResults } from "@/lib/queries/campaigns"
import { aggregateSnapshots } from "@/lib/queries/analytics"
import { createServerClient } from "@/lib/supabase/server"
import type { ClientSnapshot } from "@/types/analytics"
import type { ClientConfig } from "@/types/analytics"

interface ClientPageProps {
  params: Promise<{ slug: string }>
}

export default async function ClientPage({ params }: ClientPageProps) {
  const { slug } = await params

  // Validate slug via DB lookup
  const setup = await getSetupBySlug(slug)
  if (!setup) {
    notFound()
  }

  // If not completed, show provisioning/setup banner
  if (setup.status !== "completed") {
    const isFailed = setup.status === "failed"
    const statusMessages: Record<string, string> = {
      draft: "This client setup has not been started yet.",
      configuring: "This client is being configured in the setup wizard.",
      purchasing: "Domains are being purchased. This usually takes a few minutes.",
      provisioning: "Domains and mailboxes are being provisioned. DNS propagation can take 1-6 hours.",
      smartlead_pending: "Waiting for Smartlead integration to complete.",
      failed: setup.error_message ?? "The setup encountered an error. View details to retry.",
    }
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground capitalize">
            {setup.display_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFailed ? "Client setup failed" : "Client setup in progress"}
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className={cn(
                "rounded-lg p-2.5",
                isFailed ? "bg-rose-100 dark:bg-rose-950/50" : "bg-sky-100 dark:bg-sky-950/50"
              )}>
                <Loader2 className={cn(
                  "h-5 w-5",
                  isFailed ? "text-rose-600" : "text-sky-600 animate-spin"
                )} />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground">
                  {isFailed ? "Setup Failed" : "Setup In Progress"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {statusMessages[setup.status] ?? `Current status: ${setup.status}`}
                </p>
                {setup.domain_count != null && setup.total_mailboxes != null && (
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    <span>{setup.domain_count} domains</span>
                    <span>{setup.total_mailboxes} mailboxes</span>
                  </div>
                )}
                <div className="mt-4">
                  <Link
                    href={`/onboarding/${setup.id}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors",
                      isFailed ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
                    )}
                  >
                    {isFailed ? "View Details & Retry" : "View Setup Progress"}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const client = slug
  const supabase = createServerClient()

  // Resolve child slugs for parent-client aggregation (e.g., roosterpunk → [roosterpunk_us, roosterpunk_uk])
  const childSlugs = await resolveClientSlugs(client)

  // Fetch shared data in parallel
  const [snapshotsRes, alertCountRes, configsRes, placementResults] = await Promise.all([
    supabase
      .from("analytics_snapshots")
      .select("*")
      .in("client", childSlugs)
      .order("snapshot_date", { ascending: false }),
    supabase
      .from("mailbox_alerts")
      .select("*, mailbox_domains!inner(client)", { count: "exact", head: true })
      .eq("status", "pending")
      .in("mailbox_domains.client", childSlugs),
    supabase
      .from("client_analytics_config")
      .select("*")
      .in("client", childSlugs),
    getClientPlacementResults(client),
  ])

  // Get latest snapshot per child slug, then aggregate
  const latestByChild = new Map<string, ClientSnapshot>()
  if (snapshotsRes.data) {
    for (const s of snapshotsRes.data) {
      if (!latestByChild.has(s.client)) {
        latestByChild.set(s.client, s as ClientSnapshot)
      }
    }
  }
  const latestSnapshot = aggregateSnapshots(Array.from(latestByChild.values()))
  if (latestSnapshot) {
    latestSnapshot.client = client
  }

  const alertCount = alertCountRes.count ?? 0
  const childConfigs = (configsRes.data ?? []) as ClientConfig[]

  // Build an aggregated config for parent clients, or use the single config
  let config: ClientConfig | null = null
  if (childConfigs.length === 1) {
    config = childConfigs[0]
  } else if (childConfigs.length > 1) {
    config = {
      ...childConfigs[0],
      client,
      display_name: setup.display_name
        ?? client.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      parent_client: null,
      daily_email_target: childConfigs.reduce((sum, c) => sum + (c.daily_email_target ?? 0), 0),
      runway_warning_days: Math.min(...childConfigs.map((c) => c.runway_warning_days)),
      runway_critical_days: Math.min(...childConfigs.map((c) => c.runway_critical_days)),
    }
  }
  const displayName = config?.display_name ?? slug

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
