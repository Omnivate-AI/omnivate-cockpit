"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, AlertTriangle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface NotificationAlert {
  id: number
  alert_type: string
  severity: string
  title: string
  description: string | null
  client: string
  created_at: string
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  return `${diffDays}d ago`
}

interface NotificationCenterProps {
  alertCount: number
}

export function NotificationCenter({ alertCount }: NotificationCenterProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<NotificationAlert[]>([])
  const [loading, setLoading] = useState(false)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/alerts/recent")
      if (res.ok) {
        const data = await res.json()
        setAlerts(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchAlerts()
    }
  }, [open, fetchAlerts])

  const handleAlertClick = (alert: NotificationAlert) => {
    setOpen(false)
    router.push(`/clients/${alert.client}?tab=alerts`)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {alertCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {alertCount > 99 ? "99+" : alertCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-96 p-0" aria-describedby={undefined}>
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-base">Notifications</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm">No pending alerts</p>
              </div>
            ) : (
              <ul className="divide-y">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <button
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => handleAlertClick(alert)}
                    >
                      <div className="mt-0.5 shrink-0">
                        {alert.severity === "critical" ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {alert.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{alert.client}</span>
                          <span>·</span>
                          <span>{relativeTime(alert.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="border-t px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-sm"
                onClick={() => {
                  setOpen(false)
                  router.push("/alerts")
                }}
              >
                View all alerts
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
