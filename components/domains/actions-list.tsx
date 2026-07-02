"use client"

import { useState } from "react"
import { formatDistanceToNow, format } from "date-fns"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { MailboxAction } from "@/lib/types"

interface ActionsListProps {
  actions: MailboxAction[]
}

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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-muted-foreground min-w-[120px]">
        {label}:
      </span>
      <span className="font-mono text-xs break-all">{value}</span>
    </div>
  )
}

function renderDetails(details: Record<string, unknown> | null): React.ReactNode {
  if (!details || Object.keys(details).length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No details</p>
    )
  }

  return (
    <div className="space-y-1">
      {Object.entries(details).map(([key, value]) => {
        const displayValue =
          typeof value === "object" && value !== null
            ? JSON.stringify(value, null, 2)
            : String(value ?? "—")
        return <DetailRow key={key} label={key} value={displayValue} />
      })}
    </div>
  )
}

function ActionRow({ action }: { action: MailboxAction }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-accent/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <span className="text-sm font-medium min-w-[140px]">
          {formatActionType(action.action_type)}
        </span>

        <ActionStatusBadge status={action.status} />

        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {action.approved_by && (
            <span className="mr-3 font-mono">{action.approved_by}</span>
          )}
          <span title={format(new Date(action.created_at), "PPpp")}>
            {formatDistanceToNow(new Date(action.created_at), {
              addSuffix: true,
            })}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-11 space-y-2">
          {renderDetails(action.details)}
          {action.error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              Error: {action.error}
            </p>
          )}
          {action.executed_at && (
            <p className="text-xs text-muted-foreground">
              Executed:{" "}
              {format(new Date(action.executed_at), "MMM d, yyyy h:mm a")}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function ActionsList({ actions }: ActionsListProps) {
  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm font-medium">No actions recorded</p>
        <p className="text-xs mt-1">
          Actions will appear here when domain operations are performed
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      {actions.map((action) => (
        <ActionRow key={action.id} action={action} />
      ))}
    </div>
  )
}
