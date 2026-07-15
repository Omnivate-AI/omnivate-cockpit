import { createServerClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"
import { RealtimeAlerts } from "@/components/layout/realtime-alerts"
import { getActiveClients } from "@/lib/queries"
import { DEFAULT_CLIENTS } from "@/lib/types"

// Live dashboard over sp_* — never prerender at build time (no baked data,
// no DB dependency during builds). Applies to every (dashboard) page.
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  // Sidebar badge = NEEDS-ACTION count: open + actionable + un-acknowledged
  // (migration 008 tier + Phase 8 acknowledge). It used to count every open
  // alert incl. maintenance (~109) — the raw pile the alert rebuild set out
  // to stop trusting; now it matches the "needs attention" number the rest
  // of the app shows.
  const { count } = await supabase
    .from("vw_cockpit_alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "open")
    .eq("tier", "actionable")
    .is("acknowledged_at", null)

  // Active clients from sp_clients, fallback to hardcoded list
  let clients: string[]
  try {
    clients = await getActiveClients()
    if (clients.length === 0) clients = [...DEFAULT_CLIENTS]
  } catch {
    clients = [...DEFAULT_CLIENTS]
  }

  return (
    <AppShell alertCount={count ?? 0} clients={clients}>
      <RealtimeAlerts />
      {children}
    </AppShell>
  )
}
