"use client"

import { useState, useEffect } from "react"
import { Loader2, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineEvent {
  id: number
  action_type: string
  action_status: string
  details: Record<string, unknown> | null
  created_at: string
  executed_at: string | null
  error: string | null
}

const ACTION_COLORS: Record<string, { dot: string; badge: string }> = {
  rotate: { dot: "bg-red-500", badge: "bg-red-100 text-red-700" },
  drain: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700" },
  rest: { dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700" },
  swap: { dot: "bg-purple-500", badge: "bg-purple-100 text-purple-700" },
  activate: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  health_check: { dot: "bg-sky-500", badge: "bg-sky-100 text-sky-700" },
}

const DEFAULT_COLORS = { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-700" }

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function extractDescription(event: TimelineEvent): string {
  const details = event.details
  if (details?.reason && typeof details.reason === "string") return details.reason
  if (details?.description && typeof details.description === "string") return details.description

  // Build description from details fields
  const parts: string[] = []
  if (details?.previous_status && details?.new_status) {
    parts.push(`${details.previous_status} → ${details.new_status}`)
  }
  if (event.error) {
    parts.push(`Error: ${event.error}`)
  }
  if (parts.length > 0) return parts.join(". ")

  return event.action_status
}

interface MailboxEventTimelineProps {
  accountId: number
}

export function MailboxEventTimeline({ accountId }: MailboxEventTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetch(`/api/mailboxes/${accountId}/timeline`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setEvents(data.events ?? [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading events...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <Clock className="h-4 w-4" />
        No events recorded
      </div>
    )
  }

  return (
    <div className="relative pl-6 py-2">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />

      <div className="space-y-4">
        {events.map((event) => {
          const colors = ACTION_COLORS[event.action_type] ?? DEFAULT_COLORS

          return (
            <div key={event.id} className="relative flex gap-3">
              {/* Dot */}
              <div
                className={cn(
                  "absolute -left-6 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                  colors.dot
                )}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                      colors.badge
                    )}
                  >
                    {event.action_type.replace(/_/g, " ")}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      event.action_status === "completed"
                        ? "bg-emerald-50 text-emerald-600"
                        : event.action_status === "failed"
                          ? "bg-red-50 text-red-600"
                          : "bg-gray-50 text-gray-600"
                    )}
                  >
                    {event.action_status}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelativeTime(event.created_at)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground truncate">
                  {extractDescription(event)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
