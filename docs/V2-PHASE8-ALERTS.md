# Phase 8 — Alerts That Behave Like Alerts

**For:** Omar · **From:** Amzat · **Date:** 2026-07-15
**Scope (plan):** the alert list becomes something you *process*, not something that vanishes or shouts. Acknowledge = a real greyed state; Resolve keeps its note + routes you to the fix; red is reserved for genuinely critical actionable items; the page leads with what needs action.

Live at https://omnivate-cockpit.vercel.app → `/alerts` (global) and any client → Alerts tab (both use the same table).

## What changed

### 1. Acknowledge is a real state — not a silent delete
Before: the "Ack" button hard-**resolved** the alert (status → resolved, "Dismissed via dashboard"); it vanished (answer #8). Now acknowledging:
- sets `acknowledged_at` / `acknowledged_by` and **keeps `status='open'`** (migration 019 added the columns to both alert tables + the view);
- the row **stays visible, greyed**, dropping into an "Acknowledged & maintenance" group below the needs-action list, timestamped ("acknowledged 5m ago");
- it is **excluded from every "needs attention" count** — the Command Center banner, the sidebar badge, the critical/warning summary cards, and the per-client summary all skip acknowledged alerts;
- it is never deleted. Resolve (separate) still closes an alert with a note.

Proven at the DB level (staged + reverted): acking a real actionable alert kept it `open`, dropped the needs-action count 29→28, and it stayed in the open list.

### 2. Resolve keeps its note + context routing
Every alert now carries a **"take me to the fix"** link, mapped by type (one dynamic mapping, keyword-matched so sibling types route without a code change):

| Alert type | Routes to |
|---|---|
| burn / warmup / drift / tag / blacklist / ungrouped / mailbox / domain / catch-all | client **Mailboxes** tab (action-required is at the top) |
| lead runway / ready-bank | client **Overview** (Ready Bank card) |
| send-floor / send-block / idle / paused | client **Overview** |
| placement / spam / inbox-test | client **Placement** tab |
| anything else | client **Overview** |

The link shows both inline on each row and in the expanded detail ("Take me to → View mailboxes"). Resolve keeps its optional note exactly as before.

### 3. Severity presentation — red only where it's earned
Before: the badge coloured by severity alone, so a **maintenance/high** like `warmup_needs_reconnect` (33 live) or `warmup_reapply_failed` (16) wore **red** — informational noise shouting like a fire (answer #3). Now tone is **tier-aware** (`lib/alerts-presentation.ts`):
- **actionable + critical/high → red** (genuinely act now)
- **actionable + warning/medium → amber**
- **actionable + info/low → quiet blue**
- **any maintenance → neutral grey**, regardless of raw severity

A small **legend** on the alerts view explains the four tones. Net effect: the 49 maintenance/high "warmup reconnect/reapply" items no longer render red anywhere (page, client tab, resolved table).

### 4. De-verbosed: needs-action first, everything else collapsed
The table now leads with the **needs-action** list (actionable, un-acknowledged). Acknowledged + maintenance rows collapse into an "Acknowledged & maintenance (N)" section below; recently-resolved stays collapsed under that. The critical / warning / resolved-this-week **summary cards stay** (now counting the right thing — actionable, un-acknowledged).

## Notes / decisions

- **Acknowledged has no "un-acknowledge" button yet.** An acked alert can still be Resolved; to un-ack, it would re-open on the next engine cycle if still true. Easy to add a toggle if you want one.
- **The global `/alerts` page still defaults to the `actionable` tier filter** (Omar's 07-06 rebuild) — so maintenance lives behind the tier filter there; on the client Alerts tab all tiers show, with maintenance collapsed. Both honour "nothing informational red."
- **Orphaned dead code left as-is:** `alert-table.tsx` (singular, with the disabled RotateButton), `resolved-section.tsx`, `dismiss-dialog.tsx` are unmounted — the live path is entirely `alerts-table.tsx`. Candidates for a cleanup delete.

## Where things live
- Migration: `db/migrations/cockpit_read_models_019.sql` (ack columns + view).
- Route: `app/api/alerts/[id]/acknowledge/route.ts` (acks, doesn't resolve).
- Presentation helpers: `lib/alerts-presentation.ts` (`alertTone`, `alertContextRoute`).
- Table (both surfaces): `components/alerts/alerts-table.tsx`.
- Counts: `lib/queries/alerts.ts` (all urgency counts exclude acknowledged).
