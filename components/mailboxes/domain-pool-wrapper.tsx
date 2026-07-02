"use client"

import { useState, useCallback } from "react"
import { DomainPoolSection } from "./domain-pool-section"
import type { DomainCandidate } from "./domain-pool-section"
import { OrderMailboxesModal } from "./order-mailboxes-modal"
import { OrderStatusBanner } from "./order-status-banner"

interface DomainPoolWrapperProps {
  client: string
  personas: string[]
}

export function DomainPoolWrapper({ client, personas }: DomainPoolWrapperProps) {
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderDomains, setOrderDomains] = useState<DomainCandidate[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const handleOrderClick = useCallback((domains: DomainCandidate[]) => {
    setOrderDomains(domains)
    setOrderOpen(true)
  }, [])

  const handleOrderComplete = useCallback(() => {
    // Bump refreshKey to trigger domain pool refetch
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <>
      <OrderStatusBanner client={client} />
      <DomainPoolSection
        client={client}
        onOrderClick={handleOrderClick}
        refreshKey={refreshKey}
      />
      <OrderMailboxesModal
        client={client}
        open={orderOpen}
        onOpenChange={setOrderOpen}
        domains={orderDomains}
        personas={personas}
        onOrderComplete={handleOrderComplete}
      />
    </>
  )
}
