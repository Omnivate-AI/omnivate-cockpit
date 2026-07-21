/**
 * Tab registry for the client page — a plain module (NO "use client") so the
 * SERVER page can validate ?tab and the CLIENT tab bar can render triggers
 * from the same source of truth. Server components cannot call functions
 * exported from a "use client" module (V2 Phase 4 lesson: doing so throws
 * "Attempted to call isTabValue() from the server" at runtime while tsc and
 * next build both stay green).
 */
export const TAB_CONFIG = [
  // V5 restructure (Omar): Overview = both channels side by side; the old
  // email-only overview lives on as the Email tab; LinkedIn gets its own.
  { value: "overview", label: "Overview" },
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "interested", label: "Positive Replies" },
  { value: "campaigns", label: "Campaigns" },
  { value: "pipelines", label: "Pipelines" },
  { value: "mailboxes", label: "Mailboxes" },
  { value: "placement", label: "Placement" },
  { value: "alerts", label: "Alerts" },
  { value: "settings", label: "Settings" },
] as const

export type TabValue = (typeof TAB_CONFIG)[number]["value"]

export const TAB_VALUES = TAB_CONFIG.map((t) => t.value) as readonly TabValue[]

export function isTabValue(v: string | undefined): v is TabValue {
  return v != null && (TAB_VALUES as readonly string[]).includes(v)
}
