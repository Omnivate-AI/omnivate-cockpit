/**
 * Shared time-series chart helpers (extracted from overview-performance in V4
 * so the provider charts reuse the exact same weekend semantics — E2/E3).
 * Plain module: safe to import from server or client components.
 */

export function isWeekend(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00`).getDay()
  return day === 0 || day === 6
}

/** Contiguous weekend runs (e.g. Sat→Sun) as [x1,x2] category spans for
    background ReferenceArea bands. */
export function weekendSpans(dates: string[]): { x1: string; x2: string }[] {
  const spans: { x1: string; x2: string }[] = []
  let start: string | null = null
  let prev: string | null = null
  for (const d of dates) {
    if (isWeekend(d)) {
      if (start == null) start = d
      prev = d
    } else if (start != null && prev != null) {
      spans.push({ x1: start, x2: prev })
      start = prev = null
    }
  }
  if (start != null && prev != null) spans.push({ x1: start, x2: prev })
  return spans
}

/** Continuous calendar-day list between two yyyy-MM-dd dates (inclusive). */
export function continuousDates(first: string, last: string): string[] {
  const out: string[] = []
  const d = new Date(`${first}T00:00:00`)
  const end = new Date(`${last}T00:00:00`)
  while (d <= end) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`
    )
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** A day with almost no sends but a stray reply produces a meaningless 30–60%
    "rate" that blows out the whole Y-axis (V3 E3). Below this floor a day's
    rate is null (bridged), not a spike. Shared by every rate chart. */
export const MIN_SENDS_FOR_RATE = 20

/** The day the send-events webhook capture began — the earliest date any
    distinct-contacts, recipient-split or provider-matrix number can honestly
    cover. Lives in this plain module so CLIENT components can import the
    value (importing it from lib/queries/* would pull server-only code into
    the client bundle — the tab-config.ts lesson). */
export const SEND_CAPTURE_ERA_START = "2026-06-03"

// --- Provider series shapes + pure normalizers (V4 C2/C3/C4) ---
// Plain-module residents so BOTH the server pages (Command Center) and the
// client chart components can use them (calling a "use client" export from a
// server component throws at runtime — the V2 Phase 4 lesson).

/** One day of recipient-side provider splits (vw_cockpit_recipient_daily,
    slugs summed). sent_google/… are filled from the send-events capture, so
    the series is only honest from SEND_CAPTURE_ERA_START. */
export interface RecipientDailyPoint {
  date: string
  sentTotal: number
  sentGoogle: number
  sentMicrosoft: number
  sentOther: number
  repliesTotal: number
  repliesGoogle: number
  repliesMicrosoft: number
  repliesOther: number
}

/** One day of sender-side (our mailbox pools) sends + replies per provider
    (vw_cockpit_provider_daily; smtp bucketed into "other"). */
export interface SenderDailyPoint {
  date: string
  googleSent: number
  googleReplies: number
  microsoftSent: number
  microsoftReplies: number
  otherSent: number
  otherReplies: number
}

/** One pre-aggregated matrix cell-day (cockpit_provider_matrix_daily). */
export interface ProviderMatrixDay {
  day: string
  sender: "google" | "microsoft" | "other"
  recipient: "google" | "microsoft" | "other"
  sends: number
  replies: number
}

/** Normalized per-day sends+replies per provider — one shape for both sides
    of the reply-rate chart. */
export interface ProviderRatePoint {
  date: string
  totalSent: number
  totalReplies: number
  googleSent: number
  googleReplies: number
  microsoftSent: number
  microsoftReplies: number
  otherSent: number
  otherReplies: number
}

export function fromRecipientDaily(points: RecipientDailyPoint[]): ProviderRatePoint[] {
  return points.map((p) => ({
    date: p.date,
    totalSent: p.sentTotal,
    totalReplies: p.repliesTotal,
    googleSent: p.sentGoogle,
    googleReplies: p.repliesGoogle,
    microsoftSent: p.sentMicrosoft,
    microsoftReplies: p.repliesMicrosoft,
    otherSent: p.sentOther,
    otherReplies: p.repliesOther,
  }))
}

export function fromSenderDaily(points: SenderDailyPoint[]): ProviderRatePoint[] {
  return points.map((p) => ({
    date: p.date,
    totalSent: p.googleSent + p.microsoftSent + p.otherSent,
    totalReplies: p.googleReplies + p.microsoftReplies + p.otherReplies,
    googleSent: p.googleSent,
    googleReplies: p.googleReplies,
    microsoftSent: p.microsoftSent,
    microsoftReplies: p.microsoftReplies,
    otherSent: p.otherSent,
    otherReplies: p.otherReplies,
  }))
}
