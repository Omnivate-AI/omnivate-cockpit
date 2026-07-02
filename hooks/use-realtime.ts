"use client"

import { useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

export function useRealtimeTable(table: string, onUpdate: () => void) {
  const stableOnUpdate = useCallback(onUpdate, [onUpdate])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          stableOnUpdate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, stableOnUpdate])
}
