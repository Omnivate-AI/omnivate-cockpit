"use client"

import { useState } from "react"
import Link from "next/link"
import { formatDistanceToNow, format } from "date-fns"
import { RotateButton } from "@/components/domains/rotate-button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { DismissDialog } from "./dismiss-dialog"
import type { AlertWithDomain } from "@/lib/queries"

interface AlertTableProps {
  alerts: AlertWithDomain[]
  resolved?: boolean
}

export function AlertTable({ alerts, resolved = false }: AlertTableProps) {
  const [dismissAlert, setDismissAlert] = useState<AlertWithDomain | null>(null)

  if (alerts.length === 0) {
    return null
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-muted w-[100px]">Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>{resolved ? "Resolved" : "Age"}</TableHead>
              {resolved && <TableHead>Action Taken</TableHead>}
              {!resolved && <TableHead className="w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow
                key={alert.id}
                className={cn(
                  resolved && "opacity-60"
                )}
              >
                <TableCell className="sticky left-0 z-10 bg-card">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      ["critical", "high"].includes(alert.severity)
                        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                    )}
                  >
                    {alert.severity}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  {alert.alert_type.replace(/_/g, " ")}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/domains/${alert.domain_id}`}
                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    {alert.domain_name}
                  </Link>
                  <span className="block text-xs text-muted-foreground capitalize">
                    {alert.client}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                  {alert.description ? (
                    <span className="line-clamp-2">{alert.description}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {resolved && alert.resolved_at
                    ? format(new Date(alert.resolved_at), "MMM d, yyyy")
                    : formatDistanceToNow(new Date(alert.created_at), {
                        addSuffix: true,
                      })}
                </TableCell>
                {resolved && (
                  <TableCell className="text-sm text-muted-foreground">
                    {alert.resolved_by ?? "—"}
                  </TableCell>
                )}
                {!resolved && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {["critical", "high"].includes(alert.severity) && (
                        <RotateButton
                          domainId={alert.domain_id ?? 0}
                          domainName={alert.domain_name}
                          client={alert.client}
                          alertId={alert.id}
                          variant="outline"
                          size="sm"
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setDismissAlert(alert)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {dismissAlert && (
        <DismissDialog
          alertId={dismissAlert.id}
          alertType={dismissAlert.alert_type}
          domainName={dismissAlert.domain_name}
          open={!!dismissAlert}
          onOpenChange={(open) => {
            if (!open) setDismissAlert(null)
          }}
        />
      )}
    </>
  )
}
