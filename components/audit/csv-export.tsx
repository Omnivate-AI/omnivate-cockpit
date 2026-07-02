"use client"

import { useState, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { format } from "date-fns"

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function CsvExportInner() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  const handleExport = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      const actionType = searchParams.get("action")
      const client = searchParams.get("client")
      const status = searchParams.get("status")
      const dateRange = searchParams.get("range")

      let query = supabase
        .from("mailbox_actions_log")
        .select("*, mailbox_domains(domain_name, client)")
        .order("created_at", { ascending: false })
        .limit(1000)

      if (actionType) {
        query = query.eq("action_type", actionType)
      }
      if (status) {
        query = query.eq("status", status)
      }
      if (dateRange && dateRange !== "all") {
        const since = new Date()
        since.setDate(since.getDate() - Number(dateRange))
        query = query.gte("created_at", since.toISOString())
      }

      const { data } = await query

      if (!data || data.length === 0) {
        return
      }

      // Map and optionally filter by client
      let rows = data.map((a) => {
        const domain = a.mailbox_domains as unknown as {
          domain_name: string
          client: string
        } | null
        return {
          date: format(new Date(a.created_at), "yyyy-MM-dd HH:mm:ss"),
          domain: domain?.domain_name ?? "Unknown",
          client: domain?.client ?? "",
          action: a.action_type,
          status: a.status,
          triggered_by: a.triggered_by ?? "",
          details: a.details ? JSON.stringify(a.details) : "",
          error: a.error_message ?? "",
          completed_at: a.completed_at
            ? format(new Date(a.completed_at), "yyyy-MM-dd HH:mm:ss")
            : "",
        }
      })

      if (client) {
        rows = rows.filter((r) => r.client === client)
      }

      const headers = [
        "Date",
        "Domain",
        "Client",
        "Action",
        "Status",
        "Triggered By",
        "Details",
        "Error",
        "Completed At",
      ]

      const csvLines = [
        headers.join(","),
        ...rows.map((r) =>
          [
            r.date,
            r.domain,
            r.client,
            r.action,
            r.status,
            r.triggered_by,
            escapeCsvField(r.details),
            escapeCsvField(r.error),
            r.completed_at,
          ].join(",")
        ),
      ]

      const csv = csvLines.join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleExport}
      disabled={loading}
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  )
}

export function CsvExport() {
  return (
    <Suspense>
      <CsvExportInner />
    </Suspense>
  )
}
