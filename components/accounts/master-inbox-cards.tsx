"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, Star, ArrowRightLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { HealthIndicator } from "@/components/shared/health-indicator"
import { ChangeMasterDialog } from "@/components/accounts/change-master-dialog"
import type { MasterInboxCard } from "@/lib/queries"

interface MasterInboxCardsProps {
  cards: MasterInboxCard[]
}

export function MasterInboxCards({ cards }: MasterInboxCardsProps) {
  const [dialogClient, setDialogClient] = useState<string | null>(null)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.client} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold capitalize">
                  {card.client}
                </CardTitle>
                {card.masterAccount && (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {card.masterAccount ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Master inbox
                    </p>
                    <p className="font-mono text-sm mt-0.5 truncate">
                      {card.masterAccount.email}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Domain</p>
                      <Link
                        href={`/domains/${card.masterAccount.domain_id}`}
                        className="text-sm text-foreground hover:text-indigo-600 transition-colors"
                      >
                        {card.masterAccount.domain_name}
                      </Link>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">
                        Health
                      </p>
                      <HealthIndicator
                        value={card.masterAccount.warmup_health_pct}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      {card.accountCount} account
                      {card.accountCount !== 1 ? "s" : ""} total
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDialogClient(card.client)}
                    >
                      <ArrowRightLeft className="h-3 w-3 mr-1" />
                      Change
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      No master inbox set
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {card.accountCount} account
                    {card.accountCount !== 1 ? "s" : ""} total
                  </p>
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => setDialogClient(card.client)}
                  >
                    Set Master Inbox
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <ChangeMasterDialog
        client={dialogClient}
        open={dialogClient !== null}
        onOpenChange={(open) => {
          if (!open) setDialogClient(null)
        }}
      />
    </>
  )
}
