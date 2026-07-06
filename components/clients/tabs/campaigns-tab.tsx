import { getClientCampaigns, getClientCampaignSnapshots, getClientPlacementResults } from "@/lib/queries/campaigns"
import { CampaignPerformanceTable } from "@/components/campaigns/campaign-performance-table"
import { DeliverabilityIssues } from "@/components/campaigns/deliverability-issues"
import { Megaphone } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"

interface CampaignsTabProps {
  clientSlug: string
}

export async function CampaignsTab({ clientSlug }: CampaignsTabProps) {
  // "all" = active AND past campaigns (Omar 07-06) — the table splits them
  // by real Smartlead status and collapses the past section by default.
  const [campaigns, snapshotHistory, placements] = await Promise.all([
    getClientCampaigns(clientSlug, "all"),
    getClientCampaignSnapshots(clientSlug),
    getClientPlacementResults(clientSlug),
  ])

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No Campaigns"
        description="No campaigns found for this client."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SectionFreshness mode="sync" prefix="Campaign stats synced" />
      </div>
      {/* Deliverability issues only make sense for campaigns still sending */}
      <DeliverabilityIssues
        campaigns={campaigns.filter((c) => c.is_active)}
        placements={placements}
        snapshotHistory={snapshotHistory}
      />
      <CampaignPerformanceTable campaigns={campaigns} snapshotHistory={snapshotHistory} />
    </div>
  )
}
