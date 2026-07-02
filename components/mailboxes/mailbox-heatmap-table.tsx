"use client"

import { useState } from "react"
import { DomainHealthHeatmap } from "./domain-health-heatmap"
import { MailboxInventoryTable } from "./mailbox-inventory-table"
import type { DomainInfo } from "@/lib/scoring/burn-prediction"
import type { ClientMailboxRow } from "@/lib/queries/mailboxes"
import { Card, CardContent } from "@/components/ui/card"

interface MailboxHeatmapTableProps {
  domains: DomainInfo[]
  mailboxes: ClientMailboxRow[]
}

export function MailboxHeatmapTable({ domains, mailboxes }: MailboxHeatmapTableProps) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  return (
    <>
      <Card>
        <CardContent className="px-4 py-4">
          <DomainHealthHeatmap
            domains={domains}
            mailboxes={mailboxes}
            selectedDomain={selectedDomain}
            onDomainClick={setSelectedDomain}
          />
        </CardContent>
      </Card>

      <MailboxInventoryTable mailboxes={mailboxes} domainFilter={selectedDomain} />
    </>
  )
}
