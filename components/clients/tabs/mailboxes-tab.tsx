import {
  getClientMailboxInventory,
  getClientDomainHealthTrend,
  getClientCapacitySnapshot,
  getClientMasterInbox,
  getClientPersonas,
  getClientRotationCapacity,
} from "@/lib/queries/mailboxes"
import { RotationCapacityCard } from "@/components/mailboxes/rotation-capacity-card"
import { MailboxInventoryTable } from "@/components/mailboxes/mailbox-inventory-table"
import { MailboxHealthChart } from "@/components/mailboxes/mailbox-health-chart"
import { CapacityKPICards } from "@/components/mailboxes/capacity-kpi-cards"
import { BlacklistStatusCard } from "@/components/mailboxes/blacklist-status-card"
import { ClientOrdersCard } from "@/components/mailboxes/client-orders-card"
import { LifecycleHistoryCard } from "@/components/mailboxes/lifecycle-history-card"
import { DomainsCard } from "@/components/mailboxes/domains-card"
import { getClientBlacklist, getClientOrders } from "@/lib/queries/orders"
import { getClientLifecycleHistory } from "@/lib/queries/portfolio"
import { getClientDomains } from "@/lib/queries/clients"
import { LifecycleBreakdown } from "@/components/mailboxes/lifecycle-breakdown"
import { MasterInboxCard } from "@/components/mailboxes/master-inbox-card"
import { DomainPoolWrapper } from "@/components/mailboxes/domain-pool-wrapper"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionFreshness } from "@/components/shared/section-freshness"
import { Card, CardContent } from "@/components/ui/card"
import { Inbox } from "lucide-react"

interface MailboxesTabProps {
  clientSlug: string
}

export async function MailboxesTab({ clientSlug }: MailboxesTabProps) {
  const [mailboxes, healthTrend, capacity, masterInfo, personas, blacklist, orders, lifecycleHistory, domains, rotation] = await Promise.all([
    getClientMailboxInventory(clientSlug),
    getClientDomainHealthTrend(clientSlug, 30),
    getClientCapacitySnapshot(clientSlug),
    getClientMasterInbox(clientSlug),
    getClientPersonas(clientSlug),
    getClientBlacklist(clientSlug),
    getClientOrders(clientSlug),
    getClientLifecycleHistory(clientSlug, 30),
    getClientDomains(clientSlug),
    getClientRotationCapacity(clientSlug),
  ])

  const blacklistByDomain = Object.fromEntries(
    blacklist.rows.map((r) => [r.domain, r.status])
  )
  const masterDomains = Array.from(
    new Set(
      mailboxes
        .filter((m) => m.is_master_inbox && m.domain_name)
        .map((m) => m.domain_name)
    )
  )

  if (mailboxes.length === 0 || !capacity) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Inbox}
          title="No Mailboxes"
          description="No mailbox accounts found for this client. Use the domain pool below to order your first batch."
        />
        <DomainPoolWrapper client={clientSlug} personas={personas} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SectionFreshness mode="sync" prefix="Mailbox mirror synced" />
      </div>

      {/* HERO: 3 capacity KPI cards */}
      <CapacityKPICards data={capacity} />

      {/* A/B rotation groups: Group A alone / Group B alone / whole pool /
          reserve bench, each with real emails-per-day capacity (Omar 07-06) */}
      <RotationCapacityCard data={rotation} />

      {/* Lifecycle breakdown + Master inbox */}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <LifecycleBreakdown data={capacity} />
        <MasterInboxCard info={masterInfo} />
      </div>

      {/* 30-day health trend */}
      <Card>
        <CardContent className="px-4 py-4">
          <p className="text-sm font-medium mb-2">Domain Health Trend (30 days)</p>
          <MailboxHealthChart data={healthTrend} />
        </CardContent>
      </Card>

      {/* Lifecycle/health history from daily snapshots (HEALTH-4) */}
      <LifecycleHistoryCard history={lifecycleHistory} />

      {/* Per-domain listing: counts, lifecycle, catch-all, master (INFRA-3) */}
      <DomainsCard
        domains={domains}
        blacklistByDomain={blacklistByDomain}
        masterDomains={masterDomains}
      />

      {/* DNSBL blacklist state for this client's domains (HEALTH-3) */}
      <BlacklistStatusCard summary={blacklist} />

      {/* Domain candidate pool — always visible for capacity expansion */}
      <DomainPoolWrapper client={clientSlug} personas={personas} />

      {/* InboxKit order history + spend (INFRA-4, client scope) */}
      <ClientOrdersCard orders={orders} />

      {/* Unified inventory table with domain-grouped actions */}
      <MailboxInventoryTable mailboxes={mailboxes} client={clientSlug} />
    </div>
  )
}
