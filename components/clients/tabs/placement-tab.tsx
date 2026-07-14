import { getClientPlacementResults } from "@/lib/queries/campaigns"
import { PlacementTabView } from "./placement-tab-view"

interface PlacementTabProps {
  clientSlug: string
}

/**
 * Server wrapper (V2 Phase 4): the placement results used to be fetched by
 * the client PAGE for every request regardless of tab — now they load only
 * when this tab is actually opened. The interactive table lives in
 * placement-tab-view.tsx (client component).
 */
export async function PlacementTab({ clientSlug }: PlacementTabProps) {
  const results = await getClientPlacementResults(clientSlug)
  return <PlacementTabView results={results} />
}
