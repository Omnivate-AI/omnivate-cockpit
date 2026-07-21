import { formatRatio } from "@/lib/format"
import type { CompareStatRow } from "@/lib/queries/analytics"

/**
 * V4 E1 — the six pickable Compare parameters, exactly as Omar listed them:
 * "interested replies, the reply rate, the emails per positive reply, the
 * contacts per positive reply, the volume, the positive reply rate percentage."
 * Plain module so both server pages and client components can read it.
 */

export interface CompareMetricDef {
  key: string
  label: string
  /** One-line definition shown on the panel. */
  help: string
  /** Efficiency ratios read inverted — fewer emails per win is better. */
  lowerIsBetter?: boolean
  value: (row: CompareStatRow) => number | null
  format: (v: number) => string
}

const count = (v: number) => Math.round(v).toLocaleString()
const pct = (v: number) => `${v.toFixed(2)}%`

export const COMPARE_METRICS: CompareMetricDef[] = [
  {
    key: "positives",
    label: "Positive Replies",
    help: "Interested + human-action-required replies in the range",
    value: (r) => r.positives,
    format: count,
  },
  {
    key: "reply_rate",
    label: "Reply Rate",
    help: "Total replies ÷ emails sent",
    value: (r) => r.replyRate,
    format: pct,
  },
  {
    key: "emails_per_positive",
    label: "Emails per Positive Reply",
    help: "Emails sent ÷ positive replies",
    lowerIsBetter: true,
    value: (r) => r.emailsPerPositive,
    format: formatRatio,
  },
  {
    key: "contacts_per_positive",
    label: "Contacts per Positive Reply",
    help: "Distinct people emailed ÷ positive replies",
    lowerIsBetter: true,
    value: (r) => r.contactsPerPositive,
    format: formatRatio,
  },
  {
    key: "volume",
    label: "Volume (Emails Sent)",
    help: "Emails sent in the range",
    value: (r) => r.sends,
    format: count,
  },
  {
    key: "positive_reply_rate",
    label: "Positive Reply Rate %",
    help: "Positive replies ÷ emails sent",
    value: (r) => r.positiveReplyRate,
    format: pct,
  },
]

export const COMPARE_METRIC_KEYS = COMPARE_METRICS.map((m) => m.key)
