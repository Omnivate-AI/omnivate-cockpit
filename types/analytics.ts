/** Types shared across analytics API routes and UI components. */

/** Per-day-of-week email targets. Keys: mon,tue,wed,thu,fri,sat,sun. */
export interface DailyTargets {
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
}

export interface ClientConfig {
  id: number
  client: string
  display_name: string
  parent_client: string | null
  daily_email_target: number
  daily_targets: DailyTargets | null
  lead_table: string | null
  lead_filter: string | null
  smartlead_client_ids: number[]
  runway_warning_days: number
  runway_critical_days: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const DAY_KEYS: Array<keyof DailyTargets> = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

/** Resolve the email target for a specific date, falling back to daily_email_target on weekdays / 0 on weekends. */
export function getTargetForDate(
  dateStr: string,
  dailyEmailTarget: number,
  dailyTargets: DailyTargets | null
): number {
  const dayIndex = new Date(dateStr).getDay() // 0=Sun
  if (dailyTargets) {
    return dailyTargets[DAY_KEYS[dayIndex]] ?? 0
  }
  // Backward compat: weekdays use daily_email_target, weekends 0
  return dayIndex === 0 || dayIndex === 6 ? 0 : dailyEmailTarget
}

export interface ClientSnapshot {
  client: string
  display_name: string
  parent_client: string | null
  ready_leads: number
  qualified_no_email: number
  total_leads_in_campaigns: number
  unsent_campaign_leads: number
  subsequence_unsent: number
  emails_sent_count: number
  positive_replies_count: number
  mailbox_count: number
  estimated_max_capacity: number
  daily_email_target: number
  hitting_target: boolean
  total_runway_days: number
  campaign_runway_days: number
  pipeline_runway_days: number
  daily_capacity: number
  runway_warning_days: number
  runway_critical_days: number
  alert_types_sent: string[]
  snapshot_date: string
  // Lead status breakdown (aggregated from primary campaigns)
  leads_not_started: number
  leads_in_progress: number
  leads_completed: number
  leads_blocked: number
  // Lifetime efficiency metrics (summed across primary campaigns)
  all_time_emails_sent: number
  all_time_interested: number
}

export interface DailyPoint {
  date: string
  emails_sent_count: number
  positive_replies_count: number
  reply_count: number
  bounced: number
  hitting_target: boolean
  total_runway_days: number
}

export interface CampaignSnapshot {
  campaign_id: number
  campaign_name: string
  client: string
  campaign_type: "primary" | "subsequence"
  total_leads: number
  emails_sent: number
  bounced: number
  positive_replies: number
  reply_count: number
  unsent_leads: number
  mailbox_count: number
  positive_reply_rate: number
  snapshot_date: string
  leads_not_started: number
  leads_in_progress: number
  leads_completed: number
  leads_blocked: number
  leads_total_active: number
  sequence_length: number
  all_time_emails_sent: number
  all_time_interested: number
}

export interface SnapshotsResponse {
  clients: Array<{
    config: ClientConfig
    latest: ClientSnapshot | null
    history: DailyPoint[]
  }>
  campaigns: CampaignSnapshot[]
}

export interface CampaignHistoryResponse {
  campaign_id: number
  history: CampaignSnapshot[]
}
