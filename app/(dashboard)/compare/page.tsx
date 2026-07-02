import { GitCompareArrows } from "lucide-react"
import { getActiveClients } from "@/lib/queries/clients"
import { getClientComparisonData } from "@/lib/queries/analytics"
import { ClientSelector } from "@/components/compare/client-selector"
import { ComparisonCharts } from "@/components/compare/comparison-charts"
import { EmptyState } from "@/components/shared/empty-state"

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ clients?: string }>
}) {
  const params = await searchParams
  const allClients = await getActiveClients()

  // Parse selected clients from URL
  const selectedRaw = params.clients?.split(",").filter(Boolean) ?? []
  // Only keep valid clients
  const selected = selectedRaw.filter((c) => allClients.includes(c))

  // Fetch comparison data if 2+ clients selected
  const comparisonData =
    selected.length >= 2
      ? await getClientComparisonData(selected, 14)
      : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Client Comparison
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare 2-3 clients side by side across key metrics
        </p>
      </div>

      {/* Client multi-select */}
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">
          Select clients to compare ({selected.length}/3)
        </p>
        <ClientSelector allClients={allClients} selected={selected} />
      </div>

      {/* Charts or empty state */}
      {comparisonData ? (
        <ComparisonCharts
          sendVolume={comparisonData.sendVolume}
          replyRate={comparisonData.replyRate}
          mailboxHealth={comparisonData.mailboxHealth}
          clients={selected}
        />
      ) : (
        <EmptyState
          icon={GitCompareArrows}
          title="Select at least 2 clients to compare"
          description="Choose 2-3 clients above to see side-by-side send volume, reply rate, and mailbox health trends."
        />
      )}
    </div>
  )
}
