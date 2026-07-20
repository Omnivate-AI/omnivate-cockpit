"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Save } from "lucide-react"
import type { ClientConfig, DailyTargets } from "@/types/analytics"

const DAY_LABELS = [
  { key: "mon" as const, label: "Mon" },
  { key: "tue" as const, label: "Tue" },
  { key: "wed" as const, label: "Wed" },
  { key: "thu" as const, label: "Thu" },
  { key: "fri" as const, label: "Fri" },
  { key: "sat" as const, label: "Sat" },
  { key: "sun" as const, label: "Sun" },
]

function defaultDailyTargets(weekdayTarget: number): DailyTargets {
  return {
    mon: weekdayTarget,
    tue: weekdayTarget,
    wed: weekdayTarget,
    thu: weekdayTarget,
    fri: weekdayTarget,
    sat: 0,
    sun: 0,
  }
}

interface SettingsTabProps {
  clientSlug: string
  config: ClientConfig
  estimatedCapacity: number
}

export function SettingsTab({ clientSlug, config, estimatedCapacity }: SettingsTabProps) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(config.display_name)
  const [dailyTarget, setDailyTarget] = useState(config.daily_email_target)
  const [dailyTargets, setDailyTargets] = useState<DailyTargets>(
    config.daily_targets ?? defaultDailyTargets(config.daily_email_target)
  )
  const [warningDays, setWarningDays] = useState(config.runway_warning_days)
  const [criticalDays, setCriticalDays] = useState(config.runway_critical_days)
  const [saving, setSaving] = useState(false)

  const maxDayTarget = Math.max(...Object.values(dailyTargets))
  const utilization = estimatedCapacity > 0
    ? Math.round((maxDayTarget / estimatedCapacity) * 100)
    : 0

  const overCapacity = maxDayTarget > estimatedCapacity && estimatedCapacity > 0

  function handleDayChange(key: keyof DailyTargets, value: number) {
    setDailyTargets((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error("Display name is required")
      return
    }
    if (dailyTarget <= 0 || warningDays <= 0 || criticalDays <= 0) {
      toast.error("All numeric fields must be positive")
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientSlug)}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          daily_email_target: dailyTarget,
          daily_targets: dailyTargets,
          runway_warning_days: warningDays,
          runway_critical_days: criticalDays,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to save settings")
      }

      toast.success("Settings saved successfully")
      // Re-fetch server components so the new target reflects across the app
      // immediately (pairs with revalidatePath in the PUT route — Omar V3 A2).
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-target">Weekday Send Target</Label>
              <Input
                id="daily-target"
                type="number"
                min={1}
                value={dailyTarget}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setDailyTarget(v)
                  // Single number is master (Omar V3 A3): cascade to Mon–Fri so
                  // the charts + Sends-vs-Target (which read the per-day grid)
                  // always match what you set here. Weekends stay 0.
                  setDailyTargets((prev) => ({
                    ...prev,
                    mon: v,
                    tue: v,
                    wed: v,
                    thu: v,
                    fri: v,
                  }))
                }}
              />
              <p className="text-xs text-muted-foreground">
                Sets Mon–Fri (weekends 0). Sends-vs-Target and charts use this.
                Editing it resets any per-day overrides below.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="warning-days">Runway Warning Days</Label>
              <Input
                id="warning-days"
                type="number"
                min={1}
                value={warningDays}
                onChange={(e) => setWarningDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="critical-days">Runway Critical Days</Label>
              <Input
                id="critical-days"
                type="number"
                min={1}
                value={criticalDays}
                onChange={(e) => setCriticalDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Label>Per-Day Send Targets</Label>
            <p className="text-xs text-muted-foreground">
              Set different email targets for each day of the week. Charts and anomaly detection use these values.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
              {DAY_LABELS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label
                    htmlFor={`day-${key}`}
                    className="text-xs text-center block font-medium"
                  >
                    {label}
                  </Label>
                  <Input
                    id={`day-${key}`}
                    type="number"
                    min={0}
                    value={dailyTargets[key]}
                    onChange={(e) => handleDayChange(key, Number(e.target.value))}
                    className="text-center tabular-nums"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Capacity Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Current estimated capacity:</span>{" "}
              <span className="font-medium">{estimatedCapacity.toLocaleString()}/day</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max day target:</span>{" "}
              <span className="font-medium">{maxDayTarget.toLocaleString()}/day</span>
            </div>
            <div>
              <span className="text-muted-foreground">Utilization:</span>{" "}
              <span className="font-medium">{utilization}%</span>
            </div>
          </div>

          {overCapacity && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Highest daily target ({maxDayTarget.toLocaleString()}) exceeds estimated capacity ({estimatedCapacity.toLocaleString()}). Consider adding more mailboxes or reducing the target.
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
