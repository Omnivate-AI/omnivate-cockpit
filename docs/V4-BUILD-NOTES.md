# V4 — Build Notes & Proofs

**Status:** all 5 build phases shipped 2026-07-21 (one session, per Omar's EOD ask) · tsc clean · build green · e2e 37 passed / 3 expected skips / 1 pre-existing flaky (mailboxes tab, passed on retry, untouched by V4)
**Plan:** `docs/V4-ITERATION-PLAN.md` (Omar-facing) · **Commits:** Phase 1 `dbf8414` · 2 `7688311` · 3 `68184a6` · 4 `218ae52` · 5 `afc279c`

---

## Data layer (migration 026 — applied live via Management API)

1. `vw_cockpit_campaigns` + **`all_time_unique_contacts`** (= `sp_campaign_lifetime.unique_sent`, Smartlead's own lifetime unique-leads-contacted; appended LAST — `CREATE OR REPLACE VIEW` can't insert mid-list). This is the per-campaign "contacts" base: both card ratios stay lifetime-scoped, no mixed-window math against the send-events era.
2. **`cockpit_provider_matrix_daily`** — tiny pre-aggregated cells (day × client × sender_provider × recipient_provider → sends, replies, replies_ooo). Filled by `cockpit_fill_provider_matrix(p_days)` (SECURITY DEFINER, self-healing upsert; joins mirror the proven `sp_fill_recipient_send_split`: `from_email → vw_sp_mailboxes`, `raw_payload->>'to_email'` domain → `sp_mx_cache`; replies via `sp_replies.mailbox_id` + `recipient_provider`). pg_cron **09:15 UTC daily** (after the 09:10 recipient-split fill). FND-3 pattern: the app never scans `sp_send_events` per request.
3. Backfill run: 60 days → 454 rows.

## Reconciliation proofs (all EXACT)

| Check | App | Raw SQL |
|---|---|---|
| Matrix total sends (60d window) | 111,152 | 111,152 (`sp_send_events` rows in window — zero dropped by the joins) |
| Cylindo Tech Report Furnishing — Contacts/Pos | 343 | `round(16,792 ÷ 49)` = 343 |
| Cylindo Tech Report Furnishing — Emails/Pos | 643 | `round(31,504 ÷ 49)` = 643 |
| Cylindo Overview (This Week) — Emails/Pos | 682 | 7,499 sent ÷ 11 positives = 681.7 |
| Cylindo Overview (This Week) — Contacts/Pos | 489 | 5,383 distinct leads ÷ 11 = 489.4 |
| Cylindo 14d matrix Google→Microsoft | 0.08% area (This-Week view shows 0.07% = 2/2,977) | 5 replies / 6,012 sends (14d SQL) — Omar's "we're not hitting Microsoft" is now a number |

## What each phase changed (files)

- **P1 ratios:** revert of `f56ebcd` (CC card + Daily Summary column + Slack text + e2e flip) · `getClientContactsByRange` (per-preset `COUNT(DISTINCT lead)` via the existing RPC, end-bounded to the facts anchor; "All Time" floored at `SEND_CAPTURE_ERA_START = 2026-06-03` and labeled) · two new client-Overview cards · `lib/format.ts` `formatRatio` (1dp below 10).
- **P2 campaign cards:** hero = lifetime positive-replies COUNT · stats row Sent · Contacts/Pos · Emails/Pos · PRR% off the card face (kept in detail panel + Compare). One card component → applies to Active/Follow-up/Referral/Past.
- **P3 provider:** `components/clients/provider-insights.tsx` (`ProviderReplyRateChart` ×2 sides + `ProviderMatrixCard` 3×3 + totals rim, low-volume greying, era note) · client Overview instances follow the page's ONE range selection · CC gets both charts aggregated, fixed "Last 30 days ending {anchor}" **printed on the card** (C1) · `getClientRecipientSplit` re-anchored to `rangeWindow` (its calendar cutoff drifted vs the sender panel under one title) · split card prints its window end.
- **P4 pipelines:** NEW "Campaign Pipelines" section reads the ENGINE registry (`campaigns` + `campaign_steps` — the tables that actually carry `dependencies[]`/`parallelizable`/`condition`; the legacy `pipeline_definitions.steps` JSONB has NO dependency keys, verified) · `lib/dag-layout.ts` longest-path leveling (id-or-order dep resolution, dangling-ref + cycle guards; no-deps set = honest sequential) · every card native `<details>`, collapsed by default, active first · legacy section keeps sequential flow (its true shape) · RunPipelineButton moved out of `<summary>`.
- **P5 compare:** 6 parameters exactly as listed (`lib/compare-metrics.ts`) · `MetricSelector` chips (`?metrics=`) · client cap removed · range presets as links (`?range=`) · `getClientCompareStats` (same window + formulas as CC KPIs) · deleted superseded `comparison-charts.tsx` + `getClientComparisonData`.

## Gotchas recorded

- `<details>` keeps collapsed content in the DOM — e2e must assert **visibility**, not count.
- Provider-shape types + normalizers + `SEND_CAPTURE_ERA_START` live in **plain** `lib/chart-utils.ts`: the CC (server) calls the same normalizers the client charts use — value-importing them from `lib/queries/*` or a `"use client"` module would re-create the V2 Phase 4 runtime-throw.
- Engine `campaign_steps.dependencies` reference step **ids** (not step_order); legacy `depends_on_step` is ambiguous → resolver tries id first, then order.
- Recipient-side daily columns (`sent_google/…`) only exist from 2026-06-03 (send-events era) — recipient chart + matrix fetches are era-floored so pre-era days can't render as fake 0%.

## Follow-ups (small, non-blocking)

- Matrix replies count includes OOO (stored separately in `replies_ooo` — UI could exclude on a toggle if Omar wants).
- CC provider charts are fixed-30d by design (labeled); could follow the CC range selector later if asked.
- `orbitalx` still has no engine campaigns/facts — pipelines section simply shows what exists.
