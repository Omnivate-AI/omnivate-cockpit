// Centralized health/status color system
// Burn threshold sourced from trigger/monitor-mailbox-health.ts BURN_THRESHOLD constant
// Every token carries its dark: variant so consumers stay theme-correct (NFR-7).

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

const EMERALD: ColorTokens = {
  text: "text-emerald-600 dark:text-emerald-400",
  bg: "bg-emerald-50 dark:bg-emerald-950/40",
  border: "border-emerald-200 dark:border-emerald-900",
}

const AMBER: ColorTokens = {
  text: "text-amber-600 dark:text-amber-400",
  bg: "bg-amber-50 dark:bg-amber-950/40",
  border: "border-amber-200 dark:border-amber-900",
}

const ROSE: ColorTokens = {
  text: "text-rose-600 dark:text-rose-400",
  bg: "bg-rose-50 dark:bg-rose-950/40",
  border: "border-rose-200 dark:border-rose-900",
}

const BLUE: ColorTokens = {
  text: "text-blue-600 dark:text-blue-400",
  bg: "bg-blue-50 dark:bg-blue-950/40",
  border: "border-blue-200 dark:border-blue-900",
}

const NEUTRAL: ColorTokens = {
  text: "text-stone-600 dark:text-stone-400",
  bg: "bg-stone-100 dark:bg-stone-800/60",
  border: "border-stone-200 dark:border-stone-700",
}

export function healthColor(value: number): ColorTokens {
  if (value >= HEALTH_THRESHOLDS.healthy) return EMERALD
  if (value >= HEALTH_THRESHOLDS.warning) return AMBER
  return ROSE
}

// Covers both severity vocabularies: perf alerts (critical/warning/info)
// and infra alerts (high/medium/low). Unknown values fall back to neutral.
export function alertSeverityColor(severity: string): ColorTokens {
  switch (severity) {
    case "critical":
    case "high":
      return ROSE
    case "warning":
    case "medium":
      return AMBER
    case "info":
    case "low":
      return BLUE
    default:
      return NEUTRAL
  }
}

export function runwayColor(
  days: number,
  warningDays: number = 14,
  criticalDays: number = 7
): ColorTokens {
  if (days >= warningDays) return EMERALD
  if (days >= criticalDays) return AMBER
  return ROSE
}

export function replyRateColor(rate: number): ColorTokens {
  if (rate >= 2) return EMERALD
  if (rate >= 1) return AMBER
  return ROSE
}
