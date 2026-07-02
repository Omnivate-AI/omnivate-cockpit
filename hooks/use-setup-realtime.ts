"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import type { SetupStep, StepStatus } from "@/lib/types"

export interface RealtimeSetupStep extends SetupStep {}

export function useSetupRealtime(setupId: number | null) {
  const [steps, setSteps] = useState<RealtimeSetupStep[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())

  const fetchSteps = useCallback(async () => {
    if (!setupId) return

    const { data } = await supabaseRef.current
      .from("setup_steps")
      .select("*")
      .eq("setup_id", setupId)
      .order("id", { ascending: true })

    if (data) {
      setSteps(data as RealtimeSetupStep[])
    }
    setLoading(false)
  }, [setupId])

  useEffect(() => {
    if (!setupId) {
      setLoading(false)
      return
    }

    fetchSteps()

    const channel = supabaseRef.current
      .channel(`setup-steps-${setupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "setup_steps",
          filter: `setup_id=eq.${setupId}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE" && payload.new) {
            setSteps((prev) =>
              prev.map((s) =>
                s.id === (payload.new as RealtimeSetupStep).id
                  ? (payload.new as RealtimeSetupStep)
                  : s
              )
            )
          } else if (payload.eventType === "INSERT" && payload.new) {
            setSteps((prev) => [...prev, payload.new as RealtimeSetupStep])
          } else {
            // DELETE or other — refetch
            fetchSteps()
          }
        }
      )
      .subscribe()

    return () => {
      supabaseRef.current.removeChannel(channel)
    }
  }, [setupId, fetchSteps])

  return { steps, loading, refetch: fetchSteps }
}
