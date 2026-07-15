// V2 Phase 8 — the alert presentation vocabulary, in one place so every
// surface (global page, client tab, banners) agrees.
//
// SEVERITY PRESENTATION (answer #3): red is reserved for genuinely critical,
// ACTIONABLE items. Warnings are amber. Informational (low/info) is a quiet
// blue. Everything MAINTENANCE-tier goes neutral grey regardless of its raw
// severity — a maintenance/high like `warmup_needs_reconnect` (33 live) is a
// self-healing retry, not a fire, and must not wear red.

export type AlertToneKey = "critical" | "warning" | "info" | "maintenance"

export interface AlertTone {
  key: AlertToneKey
  /** Badge classes. */
  badge: string
  /** A subtle left-border/accent for the row, if wanted. */
  accent: string
  label: string
}

const TONES: Record<AlertToneKey, AlertTone> = {
  critical: {
    key: "critical",
    badge:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400",
    accent: "border-l-rose-500",
    label: "Critical",
  },
  warning: {
    key: "warning",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    accent: "border-l-amber-500",
    label: "Warning",
  },
  info: {
    key: "info",
    badge:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
    accent: "border-l-sky-500",
    label: "Info",
  },
  maintenance: {
    key: "maintenance",
    badge: "bg-muted text-muted-foreground",
    accent: "border-l-transparent",
    label: "Maintenance",
  },
}

/**
 * The tone for an alert given its severity AND tier. Tier wins: anything
 * maintenance is neutral. Within actionable, severity picks the colour.
 */
export function alertTone(
  severity: string,
  tier?: string | null
): AlertTone {
  if (tier === "maintenance") return TONES.maintenance
  const s = (severity ?? "").toLowerCase()
  if (["critical", "high"].includes(s)) return TONES.critical
  if (["warning", "medium"].includes(s)) return TONES.warning
  return TONES.info // low / info — quiet, never red
}

// --- Context routing (answer: one mapping per alert type, dynamic) ---

export interface AlertRoute {
  href: string
  label: string
}

/**
 * Where a "Resolve → take me there" / "View" action should land for an
 * alert type. Keyword-matched so new sibling types route sensibly without a
 * code change. Falls back to the client overview, or the alerts page when
 * there's no client.
 */
export function alertContextRoute(alert: {
  alert_type: string
  client?: string | null
}): AlertRoute {
  const client = alert.client
  if (!client) return { href: "/alerts", label: "Alerts" }
  const t = (alert.alert_type ?? "").toLowerCase()

  const to = (tab: string, label: string): AlertRoute => ({
    href: tab ? `/clients/${client}?tab=${tab}` : `/clients/${client}`,
    label,
  })

  // Placement / spam → placement tab
  if (t.includes("placement") || t.includes("spam") || t.includes("inbox_test")) {
    return to("placement", "View placement")
  }
  // Lead runway → Ready Bank (on the overview) / campaigns
  if (t.includes("runway") || t.includes("lead_bank") || t.includes("ready_bank")) {
    return to("overview", "View Ready Bank")
  }
  // Send floor / send block / idle campaign → client overview
  if (t.includes("send_floor") || t.includes("send_block") || t.startsWith("idle") || t.includes("paused")) {
    return to("overview", "View overview")
  }
  // Everything infra/mailbox — burns, warmup, drift, tags, blacklist,
  // ungrouped, unattributed → the Mailboxes tab (its action-required section
  // sits at the top).
  if (
    t.includes("burn") ||
    t.includes("warmup") ||
    t.includes("drift") ||
    t.includes("tag") ||
    t.includes("blacklist") ||
    t.includes("ungrouped") ||
    t.includes("mailbox") ||
    t.includes("domain") ||
    t.includes("catchall") ||
    t.includes("catch_all")
  ) {
    return to("mailboxes", "View mailboxes")
  }
  // Anything else → the client overview.
  return to("overview", "View client")
}

/** True when an open alert has been acknowledged (Phase 8 derived state). */
export function isAcknowledged(alert: {
  status: string
  acknowledged_at?: string | null
}): boolean {
  return alert.status === "open" && !!alert.acknowledged_at
}
