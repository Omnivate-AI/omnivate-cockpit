import { createServerClient } from "@/lib/supabase/server"
import { AppShell } from "@/components/layout/app-shell"
import { RealtimeAlerts } from "@/components/layout/realtime-alerts"
import { getActiveClients } from "@/lib/queries"
import { DEFAULT_CLIENTS } from "@/lib/types"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerClient()

  // Fetch unresolved alert count for sidebar badge
  const { count } = await supabase
    .from("mailbox_alerts")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  // Fetch active clients from DB, fallback to hardcoded list
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
