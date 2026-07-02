"use client"

import { useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/hooks/use-realtime"

interface AlertPayload {
  id: number
  alert_type: string
  severity: string
  client: string
  title: string
  description: string
  status: string
}

export function RealtimeAlerts() {
  const router = useRouter()

  // Subscribe to INSERT events on sp_infra_alerts for toast notifications.
  // (No-op if the table isn't in the realtime publication — degrades silently.)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("alert-insert-toasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sp_infra_alerts" },
        (payload) => {
          const alert = payload.new as AlertPayload
          // infra alerts: high/medium/low · perf alerts: critical/warning/info
          if (!["critical", "warning", "high", "medium"].includes(alert.severity)) {
            return
          }

          const isCritical = ["critical", "high"].includes(alert.severity)
          const clientSlug = alert.client

          toast(alert.title, {
            description: `${clientSlug} — ${alert.description || alert.alert_type}`,
            icon: isCritical ? (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            ),
            duration: 10000,
            action: {
              label: "View",
              onClick: () =>
                router.push(`/clients/${clientSlug}?tab=alerts`),
            },
          })

          // Refresh server components so alert counts update
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  // Keep domain change subscription for server component refresh
  const handleDomainChange = useCallback(() => {
    router.refresh()
  }, [router])

  useRealtimeTable("sp_domains", handleDomainChange)

  return null
}
