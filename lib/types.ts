export interface MailboxDomain {
  id: number
  domain_name: string
  client: string
  lifecycle_status: LifecycleStatus
  warmup_health_avg: number | null
  platform: string | null
  is_master_inbox: boolean
  inboxkit_workspace_uid: string | null
  inboxkit_domain_uid: string | null
  catch_all_email: string | null
  catch_all_configured_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MailboxAccount {
  id: number
  email: string
  domain_id: number
  client: string
  from_name: string | null
  lifecycle_status: LifecycleStatus
  warmup_health_pct: number | null
  warmup_sent: number | null
  warmup_received: number | null
  is_warmup_blocked: boolean
  max_email_per_day: number | null
  platform: string | null
  smartlead_tags: string[] | null
  campaign_ids: string[] | null
  is_master_inbox: boolean
  created_at: string
  updated_at: string
}

export interface HealthSnapshot {
  id: number
  domain_id: number
  snapshot_date: string
  avg_health_pct: number | null
  account_count: number | null
  warmup_blocked_count: number | null
  campaign_count_total: number | null
  notes: string | null
  created_at: string
}

export interface MailboxAction {
  id: number
  domain_id: number
  action_type: string
  status: string
  details: Record<string, unknown> | null
  error_message: string | null
  triggered_by: string | null
  created_at: string
  completed_at: string | null
}

export interface MailboxAlert {
  id: number
  alert_type: string
  severity: "warning" | "critical"
  client: string
  domain_id: number
  title: string
  description: string | null
  proposed_actions: unknown[] | null
  status: "pending" | "dismissed" | "resolved"
  slack_message_ts: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

// Canonical taxonomy (migration 074). burnt = actionable problem state,
// retired = terminal out-of-service. See knowledge/email-infrastructure/mailbox-health-architecture.md
export type LifecycleStatus =
  | "provisioning"
  | "warming"
  | "reserve"
  | "ramping"
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

// Keep as fallback if DB query fails
export const DEFAULT_CLIENTS = [...CLIENTS]

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
