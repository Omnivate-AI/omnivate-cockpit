"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import type { ClientConfig } from "@/types/analytics"

interface SettingsPanelProps {
  config: ClientConfig
  onConfigUpdate: (updated: ClientConfig) => void
}

interface FieldState {
  value: string
  flash: "none" | "success" | "error"
}

function SettingField({
  label,
  unit,
  fieldState,
  onChange,
  onSave,
}: {
  label: string
  unit: string
  fieldState: FieldState
  onChange: (val: string) => void
  onSave: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const borderClass =
    fieldState.flash === "success"
      ? "border-emerald-500 ring-1 ring-emerald-500/30"
      : fieldState.flash === "error"
        ? "border-red-500 ring-1 ring-red-500/30"
        : "border-gray-200 focus-within:border-gray-400"

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={fieldState.value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur()
            }
          }}
          className={`w-28 rounded-md border bg-white px-3 py-2 text-sm font-medium text-gray-900 transition-all duration-200 outline-none ${borderClass}`}
        />
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  )
}

export function SettingsPanel({ config, onConfigUpdate }: SettingsPanelProps) {
  const [fields, setFields] = useState<{
    daily_email_target: FieldState
    runway_warning_days: FieldState
    runway_critical_days: FieldState
  }>({
    daily_email_target: { value: String(config.daily_email_target), flash: "none" },
    runway_warning_days: { value: String(config.runway_warning_days), flash: "none" },
    runway_critical_days: { value: String(config.runway_critical_days), flash: "none" },
  })

  const originalValues = useRef({
    daily_email_target: config.daily_email_target,
    runway_warning_days: config.runway_warning_days,
    runway_critical_days: config.runway_critical_days,
  })

  const updateField = useCallback(
    (key: keyof typeof fields, value: string) => {
      setFields((prev) => ({
        ...prev,
        [key]: { ...prev[key], value, flash: "none" },
      }))
    },
    [],
  )

  const flashField = useCallback(
    (key: keyof typeof fields, type: "success" | "error") => {
      setFields((prev) => ({
        ...prev,
        [key]: { ...prev[key], flash: type },
      }))
      setTimeout(() => {
        setFields((prev) => ({
          ...prev,
          [key]: { ...prev[key], flash: "none" },
        }))
      }, 1500)
    },
    [],
  )

  const saveField = useCallback(
    async (key: keyof typeof fields) => {
      const numVal = Number(fields[key].value)
      if (isNaN(numVal) || numVal < 0) {
        flashField(key, "error")
        toast.error("Value must be a non-negative number")
        return
      }

      // Skip if value hasn't changed
      if (numVal === originalValues.current[key]) return

      try {
        const res = await fetch("/api/analytics/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client: config.client,
            [key]: numVal,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to save")
        }

        const { config: updatedConfig } = await res.json()
        originalValues.current[key] = numVal
        flashField(key, "success")
        toast.success("Settings saved")
        onConfigUpdate(updatedConfig)
      } catch (err) {
        flashField(key, "error")
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    },
    [fields, config.client, flashField, onConfigUpdate],
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-500">Settings</h3>
      <div className="mt-4 flex flex-wrap gap-6">
        <SettingField
          label="Daily email target"
          unit="emails/day"
          fieldState={fields.daily_email_target}
          onChange={(v) => updateField("daily_email_target", v)}
          onSave={() => saveField("daily_email_target")}
        />
        <SettingField
          label="Runway warning threshold"
          unit="days"
          fieldState={fields.runway_warning_days}
          onChange={(v) => updateField("runway_warning_days", v)}
          onSave={() => saveField("runway_warning_days")}
        />
        <SettingField
          label="Runway critical threshold"
          unit="days"
          fieldState={fields.runway_critical_days}
          onChange={(v) => updateField("runway_critical_days", v)}
          onSave={() => saveField("runway_critical_days")}
        />
      </div>
    </div>
  )
}
