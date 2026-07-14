"use client"

import { useState, Fragment } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AuditLogRow } from "@/lib/queries"

function ActionStatusBadge({ status }: { status: string }) {
  const styles =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
      : status === "failed"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
        : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}
    >
      {status}
    </span>
  )
}

function formatActionType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function DetailsPanel({
  details,
  errorMessage,
  completedAt,
}: {
  details: Record<string, unknown> | null
  errorMessage: string | null
  completedAt: string | null
}) {
  const hasContent =
    (details && Object.keys(details).length > 0) || errorMessage

  return (
    <div className="space-y-2 px-2 py-1">
      {!hasContent ? (
        <p className="text-sm text-muted-foreground italic">No details</p>
      ) : (
        <>
          {details &&
            Object.entries(details).map(([key, value]) => {
              const displayValue =
                typeof value === "object" && value !== null
                  ? JSON.stringify(value, null, 2)
                  : String(value ?? "—")
              return (
                <div key={key} className="flex gap-2 text-sm">
                  <span className="font-medium text-muted-foreground min-w-[120px]">
                    {key}:
                  </span>
                  <span className="font-mono text-xs break-all">
                    {displayValue}
                  </span>
                </div>
              )
            })}
          {errorMessage && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Error: {errorMessage}
            </p>
          )}
        </>
      )}
      {completedAt && (
        <p className="text-xs text-muted-foreground">
          Completed: {format(new Date(completedAt), "MMM d, yyyy h:mm a")}
        </p>
      )}
    </div>
  )
}

export function AuditTable({ actions }: { actions: AuditLogRow[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No actions recorded yet</p>
        <p className="text-xs mt-1">
          Actions will appear here when domain operations are performed
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]" />
            <TableHead>Date</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Triggered By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => {
            const isExpanded = expandedIds.has(action.id)
            return (
              <Fragment key={action.id}>
                <TableRow
                  className="hover:bg-stone-50 dark:hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => toggleExpanded(action.id)}
                >
                  <TableCell className="pr-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {format(new Date(action.created_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    {/* /domains/[id] is a DEF-4 redirect-to-home — link to the
                        client's mailboxes tab where domains actually live.
                        Engine-level rows (daily_routine, weekly_rotation,
                        order_engine) have no client/domain — plain em-dash,
                        never an empty self-link (audit item 15c). */}
                    {action.client ? (
                      <Link
                        href={`/clients/${action.client}?tab=mailboxes`}
                        className="font-medium text-foreground hover:text-indigo-600 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {action.domain_name ?? "—"}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {action.domain_name ?? "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize text-sm">
                    {action.client ?? <span className="text-muted-foreground">system</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatActionType(action.action_type)}
                  </TableCell>
                  <TableCell>
                    <ActionStatusBadge status={action.status} />
                  </TableCell>
                  <TableCell className="text-sm font-mono text-muted-foreground">
                    {action.approved_by ?? "—"}
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className="bg-stone-50/50 dark:bg-accent/20 hover:bg-stone-50/50 dark:hover:bg-accent/20">
                    <TableCell colSpan={7} className="py-3">
                      <DetailsPanel
                        details={action.details}
                        errorMessage={action.error}
                        completedAt={action.executed_at}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
