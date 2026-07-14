# Phase 5 — Client Graph Overhaul: Change List for Review

**For:** Omar · **From:** Amzat · **Date:** 2026-07-14
**Context:** your 07-13 approval comment asked us to overhaul the client-level graphs — remove some, update some, add new ones — our best go, then review together. This is the change list. Everything below is live at https://omnivate-cockpit.vercel.app (any client → Overview / Campaigns / Placement).

## The confirmed three-chart set (per the requirements doc)

One range selection — **This Week / This Month / All Time / custom from–to picker** — now drives the KPI cards **and** all three charts together. Switching is instant.

1. **Sends vs Target** — daily bars against the target line. The line steps with your per-weekday targets (not a flat average), weekend sends show gray, under-target weekdays show red. Hover any day: sent / target / how far under.
2. **Reply Rate Trend** *(new)* — replaces both "Sends & Reply Rate (14d)" and "Replies (30d)", which repeated each other. The line is **total replies ÷ sends per day**; the header states the period average and the **change vs the preceding period of equal length** (e.g. "+0.4pp vs prior"). Hover any day: that day's sends, replies, and rate.
3. **Positive Replies** *(new)* — the count and only the count, per the confirmed definition (Interested + human-action-required), with the period total in the header.

## Judgment calls we made (flag anything you want different)

| # | Call | Why |
|---|---|---|
| 1 | **Removed** "Sends — Last 7 Days", "Sends & Reply Rate — 14 Days", "Replies — 30 Days" | Three fixed windows telling overlapping stories; the new suite covers all of it under one range control. |
| 2 | Reply Rate Trend uses **total** replies | Matches the Phase 3 semantics decision (total-reply rate everywhere a "reply rate" is shown). The positive-reply story lives in chart 3 and the Positive Reply Rate KPI beside it. |
| 3 | Rate-change is measured as **period average vs preceding equal period**, in percentage points | Same comparison the KPI trend chips already use — one consistent "vs prior" everywhere. |
| 4 | Days with zero sends are **bridged** on the rate line (not drawn as 0%) | A no-send day has no rate; drawing 0 would fake a crash. Hover shows "— (no sends)". |
| 5 | **Kept**: Provider Performance (sender + recipient split), Ready Bank, Runway & Capacity, Recent Alerts | Actionable panels, not redundant charts. |
| 6 | **Campaigns tab**: the Type dropdown became real **sections** — Active (primary only) / Follow-up / Referral, each with its own count; Past unchanged | Follow-ups and referrals answer different questions; their volumes/rates aren't comparable to primaries, and a dropdown hid the split. |
| 7 | **Compare**: added **Inbox Placement side-by-side** (latest test per campaign, colored bars + test dates) | The data was already fetched and dropped; the overlaid sends + reply-rate day-by-day lines were already right. |
| 8 | **Placement tab**: a campaign with a single test now renders a **visible dot labeled "(1 test)"** instead of being invisible | One test is data; the old chart needed 2+ points to show anything. |

## Not touched (by design)

- Command Center KPIs/cards (Phase 3 semantics stand).
- Mailboxes-tab charts (Domain Health redesign + lifecycle weighting are Phase 7 per the plan).
- The Compare **page** (`/compare`) — client-level comparison keeps its 14-day charts; this phase's compare work was the campaign comparison dialog. Happy to fold the page into the same treatment if you want it.
