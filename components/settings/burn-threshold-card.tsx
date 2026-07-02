"use client"

import { useState } from "react"
import { Flame } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface BurnThresholdCardProps {
  initialValue: number
}

export function BurnThresholdCard({ initialValue }: BurnThresholdCardProps) {
  const [value, setValue] = useState(initialValue)
  const [saving, setSaving] = useState(false)
  const hasChanged = value !== initialValue

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/update-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "burn_threshold", value }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Burn threshold updated", {
        description: `Set to ${value}%`,
      })
    } catch (err) {
      toast.error("Failed to update threshold", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-rose-500" />
          <CardTitle className="text-lg">Burn Threshold</CardTitle>
        </div>
        <CardDescription>
          Domains with warmup health below this threshold will trigger burn
          alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <Slider
            value={[value]}
            onValueChange={([v]) => setValue(v)}
            min={80}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-2xl font-bold tabular-nums w-16 text-right">
            {value}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Range: 80% — 100%
          </p>
          <Button
            onClick={handleSave}
            disabled={!hasChanged || saving}
            size="sm"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
