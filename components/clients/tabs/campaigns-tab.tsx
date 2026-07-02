import { getClientCampaigns, getClientCampaignSnapshots, getClientPlacementResults } from "@/lib/queries/campaigns"
import { CampaignPerformanceTable } from "@/components/campaigns/campaign-performance-table"
import { DeliverabilityIssues } from "@/components/campaigns/deliverability-issues"
import { Megaphone } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

interface CampaignsTabProps {
  clientSlug: string
}

export async function CampaignsTab({ clientSlug }: CampaignsTabProps) {
  const [campaigns, snapshotHistory, placements] = await Promise.all([
    getClientCampaigns(clientSlug),
    getClientCampaignSnapshots(clientSlug),
    getClientPlacementResults(clientSlug),
  ])

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No Campaigns"
        description="No active campaigns found for this client."
      />
    )
  }

  return (
    <div className="space-y-6">
      <DeliverabilityIssues campaigns={campaigns} placements={placements} snapshotHistory={snapshotHistory} />
      <CampaignPerformanceTable campaigns={campaigns} snapshotHistory={snapshotHistory} />
    </div>
  )
}
