// Centralized health/status color system
// Burn threshold sourced from trigger/monitor-mailbox-health.ts BURN_THRESHOLD constant

export const HEALTH_THRESHOLDS = {
  healthy: 97, // matches BURN_THRESHOLD in trigger/monitor-mailbox-health.ts
  warning: 85,
  critical: 0,
} as const

export interface ColorTokens {
  text: string
  bg: string
  border: string
}

export function healthColor(value: number): ColorTokens {
  if (value >= HEALTH_THRESHOLDS.healthy) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    }
  }
  if (value >= HEALTH_THRESHOLDS.warning) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    }
  }
  return {
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
  }
}

// Covers both severity vocabularies: perf alerts (critical/warning/info)
// and infra alerts (high/medium/low). Unknown values fall back to neutral.
export function alertSeverityColor(severity: string): ColorTokens {
  switch (severity) {
    case "critical":
    case "high":
      return {
        text: "text-rose-600",
        bg: "bg-rose-50",
        border: "border-rose-200",
      }
    case "warning":
    case "medium":
      return {
        text: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
      }
    case "info":
    case "low":
      return {
        text: "text-blue-600",
        bg: "bg-blue-50",
        border: "border-blue-200",
      }
    default:
      return {
        text: "text-stone-600",
        bg: "bg-stone-100",
        border: "border-stone-200",
      }
  }
}

export function runwayColor(
  days: number,
  warningDays: number = 14,
  criticalDays: number = 7
): ColorTokens {
  if (days >= warningDays) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    }
  }
  if (days >= criticalDays) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    }
  }
  return {
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
  }
}

export function replyRateColor(rate: number): ColorTokens {
  if (rate >= 2) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    }
  }
  if (rate >= 1) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    }
  }
  return {
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
  }
}
