import { getClientCampaigns, getClientCampaignSnapshots } from "@/lib/queries/campaigns"
import { CampaignPerformanceTable } from "@/components/campaigns/campaign-performance-table"
import { Megaphone } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"

interface CampaignsTabProps {
  clientSlug: string
}

export async function CampaignsTab({ clientSlug }: CampaignsTabProps) {
  // "all" = active AND past campaigns (Omar 07-06) — the table splits them
  // by real Smartlead status and collapses the past section by default.
  // Deliverability-issues banner removed (V2 Phase 1).
  const [campaigns, snapshotHistory] = await Promise.all([
    getClientCampaigns(clientSlug, "all"),
    getClientCampaignSnapshots(clientSlug),
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
      <CampaignPerformanceTable campaigns={campaigns} snapshotHistory={snapshotHistory} />
    </div>
  )
}
