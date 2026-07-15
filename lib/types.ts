// Backed by vw_cockpit_domains (sp_domains + live account counts).
export interface MailboxDomain {
  id: number
  domain_name: string
  client: string
  lifecycle_status: LifecycleStatus
  warmup_health_avg: number | null
  latest_warmup_health: number | null
  latest_inbox_placement: number | null
  latest_bounce_rate: number | null
  platform: string | null
  provider: string | null
  catch_all_email: string | null
  catch_all_configured_at: string | null
  burn_detected_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Backed by vw_cockpit_accounts (sp_mailboxes + provider normalization + roster).
export interface MailboxAccount {
  id: number
  smartlead_account_id: number | null
  email: string
  domain_id: number | null
  domain_name: string | null
  client: string
  persona: string | null
  lifecycle_status: LifecycleStatus
  warmup_health_pct: number | null
  warmup_status: string | null
  mailbox_group: string | null
  is_warmup_blocked: boolean
  max_email_per_day: number | null
  platform: string | null
  provider_canonical: string | null
  smartlead_tags: string[] | null
  campaign_ids: number[] | null
  is_master_inbox: boolean
  created_at: string
  updated_at: string
}

// Backed by vw_cockpit_domain_health_daily (per-domain daily warmup avg
// derived from sp_daily_mailbox_facts).
export interface HealthSnapshot {
  domain_id: number
  domain_name: string | null
  client: string | null
  snapshot_date: string
  avg_health_pct: number | null
  warmup_health_pct: number | null
  sent: number | null
  replies: number | null
}

// Backed by vw_cockpit_actions (sp_actions_log + domain/mailbox attribution).
export interface MailboxAction {
  id: number
  domain_id: number | null
  account_id: number | null
  action_type: string
  status: string
  description: string | null
  details: Record<string, unknown> | null
  approved_by: string | null
  executed_at: string | null
  error: string | null
  created_at: string
}

// Backed by sp_infra_alerts UNION cockpit_alerts (via vw_cockpit_alerts).
// Status vocabulary is the sp_* one: open | resolved (the old "dismissed"
// maps to resolved + note).
export interface MailboxAlert {
  id: number
  alert_type: string
  // perf alerts use critical/warning/info; infra alerts use high/medium/low
  severity: string
  client: string
  domain_id: number | null
  title: string
  description: string | null
  proposed_actions: unknown[] | null
  status: "open" | "resolved"
  resolution_note: string | null
  slack_message_ts: string | null
  resolved_by: string | null
  resolved_at: string | null
  // Acknowledged (V2 Phase 8, migration 019): a real, VISIBLE state distinct
  // from resolved. status stays 'open'; these stamp who/when acked. An
  // acknowledged alert is greyed, kept in the list, and excluded from every
  // "needs attention" count. "acknowledged" = status='open' AND
  // acknowledged_at IS NOT NULL.
  acknowledged_at: string | null
  acknowledged_by: string | null
  created_at: string
  // Alert rebuild (Omar 2026-07-06, migration 008): 'actionable' = a human
  // must act now; 'maintenance' = self-healing retries / cleanup chores.
  // Top-line counts show actionable only.
  tier?: "actionable" | "maintenance"
  // 'infra' = sp_infra_alerts (email-infra plugin) · 'cockpit' = app-generated
  // (cockpit ids are exposed +1e9 so resolve routes band on id)
  source?: "infra" | "cockpit"
}

// Canonical taxonomy = the sp_* model (email-infra plugin owns it):
// active, warming, reserve, resting, parked, burnt, retired, master.
// provisioning/ramping/draining kept for display back-compat only.
export type LifecycleStatus =
  | "provisioning"
  | "warming"
  | "reserve"
  | "ramping"
  | "resting"
  | "parked"
  | "active"
  | "burnt"
  | "draining"
  | "retired"
  | "master"

export const LIFECYCLE_STATUS_CONFIG: Record<
  LifecycleStatus,
  {
    label: string
    color: string
    bgColor: string
    borderColor: string
    dotColor: string
  }
> = {
  provisioning: {
    label: "Provisioning",
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    dotColor: "bg-slate-400",
  },
  warming: {
    label: "Warming",
    color: "text-sky-700",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    dotColor: "bg-sky-500",
  },
  reserve: {
    label: "Reserve",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    dotColor: "bg-amber-500",
  },
  ramping: {
    label: "Ramping",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    dotColor: "bg-blue-500",
  },
  resting: {
    label: "Resting",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    dotColor: "bg-teal-500",
  },
  parked: {
    label: "Parked",
    color: "text-zinc-600",
    bgColor: "bg-zinc-50",
    borderColor: "border-zinc-200",
    dotColor: "bg-zinc-400",
  },
  active: {
    label: "Active",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  burnt: {
    label: "Burnt",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    dotColor: "bg-rose-500",
  },
  draining: {
    label: "Draining",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    dotColor: "bg-orange-500",
  },
  retired: {
    label: "Retired",
    color: "text-gray-500",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    dotColor: "bg-gray-400",
  },
  master: {
    label: "Master",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    dotColor: "bg-indigo-500",
  },
}

export interface AppSetting {
  key: string
  value: unknown
  updated_at: string
}

export const CLIENTS = [
  "roosterpunk",
  "gladlane",
  "orbitalx",
  "valda",
  "pantheon",
  "omnivate",
  "cylindo",
  "paycaptain",
  "acceleration_partners",
] as const
export type Client = (typeof CLIENTS)[number]

// Fallback if the sp_clients query fails — mirrors the CURRENT active set
// only, so a DB blip never resurrects churned clients in the sidebar.
export const DEFAULT_CLIENTS = [
  "acceleration_partners",
  "cylindo",
  "omnivate",
  "paycaptain",
]

// Display labels for client slugs (sidebar, breadcrumbs, command palette).
export const CLIENT_LABELS: Record<string, string> = {
  acceleration_partners: "AP",
  paycaptain: "PayCaptain",
  cylindo: "Cylindo",
  omnivate: "Omnivate",
}

export function clientLabel(slug: string): string {
  return (
    CLIENT_LABELS[slug] ??
    slug
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  )
}

// --- Client Onboarding Types ---

export type SetupStatus =
  | "draft"
  | "configuring"
  | "purchasing"
  | "provisioning"
  | "smartlead_pending"
  | "completed"
  | "failed"

export type StepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped"

export type StepName =
  | "workspace_created"
  | "domains_purchased"
  | "dns_propagated"
  | "mailboxes_provisioned"
  | "catch_all_configured"
  | "profile_pictures_set"
  | "smartlead_sequencer_created"
  | "smartlead_exported"
  | "smartlead_tagged"
  | "inventory_synced"

export interface ClientSetup {
  id: number
  client_slug: string
  display_name: string
  status: SetupStatus
  inboxkit_workspace_uid: string | null
  inboxkit_tag_uid: string | null
  domain_count: number | null
  mailbox_per_domain: number
  total_mailboxes: number | null
  estimated_cost_usd: number | null
  wallet_balance_usd: number | null
  contact_details: Record<string, unknown> | null
  persona_config: Record<string, unknown> | null
  selected_domains: Record<string, unknown> | null
  google_mailbox_count: number
  microsoft_mailbox_count: number
  email_format: string | null
  redirect_url: string | null
  smartlead_sequencer_uid: string | null
  trigger_run_id: string | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface SetupStep {
  id: number
  setup_id: number
  step_name: StepName
  status: StepStatus
  started_at: string | null
  completed_at: string | null
  details: Record<string, unknown> | null
  error_message: string | null
  created_at: string
}
