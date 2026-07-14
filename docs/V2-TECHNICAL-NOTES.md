# V2 Build Notes (internal)

Companion to `docs/V2-ITERATION-PLAN.md` (the Omar-facing requirements doc). This file holds the execution protocol and the technical grounding that was deliberately kept out of the requirements doc. Executing sessions read BOTH files.

---

## Session protocol (multi-session execution)

1. Start every session: `cd C:/Users/HP/omnivate-cockpit && git pull`, read `V2-ITERATION-PLAN.md` + this file.
2. One phase per session (4+5 or 6+8 can pair if the session has room). Don't start a phase on a heavy context window — stop, log, let the next session take it fresh.
3. Before ending a session: update the tracker in `V2-ITERATION-PLAN.md`, append findings to the **Build log** at the bottom of THIS file, commit + push.
4. Nothing ships unverified: `tsc` clean → `next build` green → relevant e2e green → deployed → checked on production.

**Kickoff prompt for each session:**

> Read `docs/V2-ITERATION-PLAN.md` and `docs/V2-TECHNICAL-NOTES.md` in `C:/Users/HP/omnivate-cockpit` (git pull first). Execute Phase N end to end per the session protocol. Update the tracker + build log before finishing, then commit and push.

## Decisions record

**Omar approved the full requirements doc 2026-07-13 (ClickUp comment 90120240102615)** — "happy for you to proceed". Addition in the same comment: client-level graph overhaul folded into Phase 5 (interested-replies-count chart, reply-rate + change chart, judgment-call removals/updates/additions across the client graph suite, review together after). No vetoes.

Confirmed by Amzat 2026-07-12 (Omar can veto via the requirements doc):
1. Interested = `Interested` + `human_action_required` → "Positive replies", definition labeled in UI.
2. Health score removed (client cards + client header ring).
3. Retire Domain via the decisions model (propose → in-app approve → daily routine executes). Cockpit never writes lifecycle state directly; `infraSwapEscalate`-style direct writes stay dark.
4. Digest merges into Command Center; `/digest` retires.

OPEN with Omar: Pipeline tab spec (the only open question in the requirements doc).

## Prior validation ledger (context, NOT a substitute for Phase 2)

Per Amzat: the V2 data-accuracy validation is done fresh in Phase 2 — treat prior checks as hints only, re-verify everything. For orientation: `docs/DATA-ACCURACY-VALIDATION.md` (2026-07-08) recomputed Ready Bank arithmetic, runway math, rotation capacity, send-floor logic and 7-day KPIs. On 2026-07-11/12 (plan-writing session) we additionally verified live: both rate views are ×100-correct; the "0.1%" card = all-time interested/sent (145/150,602 = 0.0963%); `sp_replies` categories = Interested 74 · human_action_required 8 · OOO 1,238 · null 186 · DNC 115 · Not Interested 89.

---

## Technical grounding (file map, verified 2026-07-11/12)

| Area | Where | Notes |
|---|---|---|
| Sidebar brand | `components/layout/sidebar.tsx:108-113` | Lucide `Mail` glyph + "Omnivate Cockpit" text; real mark only in `app/icon.png` |
| Health ring | `components/shared/health-ring.tsx`, score `lib/scoring/client-health.ts:71-99`, card `components/dashboard/client-summary-card.tsx:113-119`, header `components/clients/client-header.tsx:129-135` | Remove ring; keep bell (`client-summary-card.tsx:226-231` = open actionable alerts) |
| Sends-vs-target bar | `client-summary-card.tsx:136-141`, `components/shared/progress-bar.tsx:11-16` | red <50% of target |
| KPI cards | `app/(dashboard)/page.tsx:106-147`, `lib/queries/analytics.ts:336-407` | Reply-rate card: `analytics.ts:391-392` uses `all_time_interested/all_time_emails_sent` — change to period replies/sent |
| Today-live strip | `components/shared/today-live-strip.tsx`; rendered `page.tsx:88-93`, `overview-tab.tsx:89-93`; view `vw_cockpit_today_live` | Remove renders; keep view |
| Send-drop callout | `components/clients/anomaly-callouts.tsx`, `lib/scoring/anomaly-detection.ts:53-77`, rendered `overview-tab.tsx:96` | Remove from overview |
| Data freshness | `components/dashboard/sync-status-widget.tsx` (bottom panel, `page.tsx:165-167`); `DataAsOf`/`SectionFreshness` in `components/shared/` | Replace panel with header line; components exist |
| Alert labels/tiers | `lib/design-tokens.ts:55-69`, `lib/queries/alerts.ts:10-14,219-224`, table `components/alerts/alerts-table.tsx:151-164` | severity critical/high/warning/medium/info/low; tier actionable/maintenance |
| Ack/Resolve | `app/api/alerts/[id]/acknowledge/route.ts` + `resolve/route.ts`, `alerts-table.tsx:178-225` | Both hard-resolve today; ids ≥1e9 = `cockpit_alerts`, else `sp_infra_alerts` |
| Campaign cards | `components/campaigns/campaign-performance-table.tsx` (sparklines :281-287, health pill :306-308, mark-done :311-316, disabled actions :317-322), `campaign-actions.tsx` (Smartlead URL :65) | Detail = inline expand → `/api/campaigns/{smartlead_id}/detail` |
| Campaign daily series | `vw_cockpit_campaign_daily` — verified in DB: `positive_reply_rate` IS ×100 (round(...,2)) | detail panel `campaign-detail-panel.tsx:356,398` fine on scale; audit the sparse daily-sends data instead |
| Mailbox rates | `vw_cockpit_mailbox_rates` — verified ×100 in DB; table `components/mailboxes/mailbox-inventory-table.tsx:478-489,565-663` | 1.4%=spam_rate_pct · 6=campaign_ids.length · 30=max_email_per_day |
| Add Capacity (dead) | `components/mailboxes/domain-pool-section.tsx:261`, `domain-pool-wrapper.tsx`, `order-mailboxes-modal.tsx`; route `app/api/clients/[slug]/order-mailboxes/route.ts:6-13` = **410** | Delete UI + route |
| Request order (live) | `components/mailboxes/decisions-panel.tsx:108-153`, `app/api/clients/[slug]/request-order/route.ts` | inserts pending `sp_decisions` `order_mailboxes`; dedupes; never spends |
| Retire domain (broken) | `mailbox-inventory-table.tsx:303-325,440-448,519-524` → `app/api/domains/drain/route.ts:6-13` = **410** | Rebuild via decisions model (decision #3) |
| Domain health chart | `components/mailboxes/mailbox-health-chart.tsx`, `lib/queries/mailboxes.ts:251-283` (`vw_cockpit_domain_health_daily.warmup_health_pct`, avg across domains) | Flat 100 = healthy pool averaged; redesign |
| Lifecycle history | `components/mailboxes/lifecycle-history-card.tsx`, `lib/queries/portfolio.ts:104-154` | Naive pairwise mean on parent rollup `portfolio.ts:125-142` — fix weighting |
| Interested leads tab | `components/clients/tabs/interested-leads-tab.tsx` (Smartlead link :18-20 `master-inbox?leadMap={smartlead_lead_id}`); table `cockpit_interested_leads`; refresh `fn_cockpit_snapshot_interested_leads()` cron 09:14 UTC (mig 015) | Tab definition today = `sp_replies` `lead_category_name='Interested'` ONLY (mig 013/014) — changes per decision #1 |
| Ready Bank | `cockpit_ready_bank_daily` (mig 010/016), `fn_cockpit_snapshot_ready_bank()` cron 09:12 UTC; reads `v_{slug}_tam` per client; card `components/clients/ready-bank-card.tsx` | omnivate qualified hardcoded 0 (016.sql:98-104); in_campaign = `smartlead_uploaded` → switch to actually-emailed |
| Sends/target sources | targets: `client_analytics_config.daily_email_target`(+weekday json) vs `sp_clients.min_daily_send_volume` (send-floor, mig 012) | Two concepts — reconcile per client |
| Runway | `vw_cockpit_client_runway` (mig 007:60-114), thresholds `client_analytics_config` 7/3, colors `design-tokens.ts:71-79` | |
| Provider perf | sender `vw_cockpit_provider_daily` (`analytics.ts:1007-1050`), recipient `vw_cockpit_recipient_daily` (`portfolio.ts:41-77`) | Recipient send-split only where send-event capture exists (historically Cylindo) |
| Placement | `vw_cockpit_placement_results`, `campaigns.ts:401-415`, chart `placement-trend-chart.tsx` | 1 test = 1 point = no line; ≥2 points needed |
| Orders | `vw_cockpit_orders`, `lib/queries/orders.ts:42-56`, page `app/(dashboard)/orders/page.tsx:45-76` | spent = completed only; awaiting = projected |
| Audit log | `vw_cockpit_actions` via `lib/queries.ts:486-537` | |
| Compare | `lib/queries/analytics.ts:840-916` | replyRate ×100 correct |
| Tab slowness | `app/(dashboard)/layout.tsx:9` force-dynamic; `clients/[slug]/page.tsx:93-135` renders ALL tabs as awaited props; `client-tabs.tsx:47-58` router.replace re-runs everything; no per-tab Suspense; Mailboxes tab = 11 queries (`mailboxes-tab.tsx:36-48`) | Phase 4 architecture fix |
| Digest | `app/(dashboard)/digest/page.tsx` (`getDigestData` `analytics.ts:1074-1216` ≠ `getGlobalKPIs` path); copy text built `digest/page.tsx:30-74` | Phase 9 merge |
| Feature flags | `lib/flags.ts` — ON: pipelineActions, infraDecisions, infraDecisionApprove, infraOrderRequest; OFF: onboarding, infraActions, campaignActions, infraSwapEscalate | |
| DB access workaround | MCP supabase token flaps → Management API `POST /v1/projects/uivgowblojtyiobhgjlv/database/query`, token = `SUPABASE_ACCESS_TOKEN` in `C:/Users/HP/email-infra-plugin/plugins/email-infra-plugin/.env.local`, `--data-binary @file` | Verified working 2026-07-12 |

**Related repos:** smartlead-perf-plugin (sync logic — Phase 3 sync fixes land there via PR), email-infra plugin (decisions/order engine — Phase 7 integrates, never bypasses). The mother repo `omnivate-ai-outbound` is read-only reference for schema rules (Phase 6); anything needed there goes via branch + PR for Omar.

---

## Build log

_(sessions append findings here — newest first)_

### 2026-07-14 — Phase 2 done (numbers audit, read-only)

Full checklist executed against Supabase AND live Smartlead (7/14/30d windows, AP + Cylindo; 60 campaigns swept, ~700 live API calls, zero writes). Deliverable: **`docs/V2-AUDIT-FINDINGS.md`** — verdict matrix (14 ✅ · 12 🟡 · 8 🔴), root causes RC-1…RC-10, and the exact Phase 3 fix/backfill list. Headlines:

- **Sends are exact everywhere** (Cylindo 7/14/30d deltas 0/0/0 vs live Smartlead; AP deltas are entirely weekend sends). Lifetime stats, runway math, placement values (per-seed recompute matched to the row), mailbox reply rates, orders spend semantics: all verified good.
- **Replies undercount 5–7%, positives 24–31% (14/30d)** — the sync writes each day once and never revisits; late replies/categorizations are permanently lost (RC-1). Weekend dates are skipped by design but AP really sent 67 emails on 07-11/12 (RC-2).
- **Command Center shows all zeros every Sun+Mon** — calendar cutoff `≥ today−1` over business-day-only facts (RC-3).
- **All 26 tested conversation links are dead** — URL passes `smartlead_lead_id` where `?leadMap=` needs `campaign_lead_map_id` (different namespace). Tyler Lopez: stored id is his real *lead* id (resolves empty); his true map id 3244548229 opens his exact conversation. Fix = store map id in category capture + backfill (RC-9).
- **Rotation swap (07-13) left `sp_mailboxes.max_email_per_day` stale/inverted** — active boxes show 5/day (real: 25), resting 30 (real: 5); every capacity view + Daily Limit column reads the stale column while the correctly-synced `daily_send_limit` sits unused (RC-6).
- **Three "reply rate"/"interested" semantics across surfaces** (header/digest = all-time interested rate — the formula Omar rejected — still live outside the Command Center); Interested tab undercounts Cylindo ~60% (webhook-era only). Smartlead's own lifetime `interested` ≈ Interested + human_action_required — supports decision #1; canonical per-lead source recommendation: `sp_campaign_leads` current category (RC-4, RC-10).
- **OrbitalX**: active in `sp_clients` but missing from the sync's `CLIENT_MATCHERS` → zero facts ever, blank card; needs an Omar decision — track it or deactivate it (RC-8).
- Digest vs CC quantified for the Phase 9 merge: digest header rate 0.11% (all-time) vs CC 1.45% (7d); digest "Total Replies" 2,835 (lifetime) beside "Sent" 5,510 (latest day) (RC-7).

Method notes for future audits: MCP supabase token was dead again — Management API workaround from this file's DB-access row worked throughout. Smartlead ground truth = the same endpoints the sync uses (`sequence-analytics` day/window, `/analytics` lifetime); `GET /master-inbox/{leadMap}` is the link-resolution oracle; `/campaigns/{id}/leads?lead_category_id=` returns `campaign_lead_map_id` (the `?email=` filter 400s). Sweep/window scripts preserved in the session scratchpad (`sl.mjs`, `sl-windows.mjs`) — Phase 3's backfill can reuse the trailing re-pull pattern.

### 2026-07-13 — Phase 1 shipped (declutter, branding, dead-button removal)

**Omar approved the requirements doc this morning** (ClickUp comment 90120240102615) with one addition — client-level graph overhaul — folded into Phase 5 (see Decisions record above).

Everything in the Phase 1 list landed:
- **Branding:** sidebar now uses the real Omnivate mark (`app/icon.png` copied to `public/omnivate-mark.png`) + wordmark "Omnivate" (`components/layout/sidebar.tsx`).
- **Command Center:** Today-live strip, Actionable Alerts + Sending Capacity KPI cards, health-score rings, bottom Data Freshness panel all removed. KPI grid is 4 cards. Reply-rate card is now **period replies ÷ period sends, labeled with the range** (`getGlobalKPIs` — also dropped the now-unneeded lifetime/capacity/alerts queries, 3 fewer DB hits per load). Header freshness line now reads "Data as of {day} · synced {time}" (`DataAsOf` gained `syncedAt` support in facts mode + compact `fmtSyncStamp`; `SectionFreshness` gained `synced` prop). Amber overdue pill fires on stale facts OR stale sync.
- **Client pages:** overview lost the live strip, anomaly (send-drop) callout and the Mailbox Health proxy card; header lost the health ring; Runway & Capacity lost the Pipeline Runway element (Ready Bank card owns the lead-bank story). Campaign cards: sparklines + health pill + disabled Pause/Resume gone; Mark Done + View-in-Smartlead stay (`campaign-actions.tsx` rewritten link-only); Sent/Interested numbers now show on all ≥sm screens. Detail panel: Attached Mailboxes + Smartlead Live Data sections gone (detail API response untouched — trim in Phase 4 when tabs get per-tab fetches). Campaigns tab: deliverability-issues banner gone.
- **Mailboxes tab:** legacy Add Capacity flow deleted end to end — `domain-pool-section/wrapper`, `order-mailboxes-modal`, dead `order-mailboxes` (410) route AND its `domain-candidates` companion route (only caller was the deleted UI). Request order (decisions panel) is the one ordering path. **Found during work:** the Action Required domain groups rendered mailbox rows with NO header row — that's where Omar's "1.4% · 6 · 30" mystery came from. Both tables now share `MailboxTableHead` with hover explanations on Health / Spam Rate / Campaigns / Daily Limit.
- **Deleted orphans:** today-live-strip, health-ring, client-health scoring, anomaly-callouts + anomaly-detection scoring, sync-status-widget, mini-sparkline, campaign-health-badge, deliverability-issues. `getTodayLive`/`getClientAnomalyHistory`/`getClientPersonas` query fns kept (harmless, may serve later phases). `/api/tasks/recent-runs` kept (was the freshness panel's API; candidate for Phase 9 cleanup if still unused).
- **Tests:** command-center + client-detail specs updated — removals asserted as negatives (they must STAY removed), reply-rate label asserted range-scoped, sidebar brand asserted. New `e2e/phase-screens.spec.ts` (SCREENSHOTS=1-gated) captures the acceptance screenshot set to `e2e/screenshots/`.

Verification (final): `tsc` clean · `next build` green · e2e local **34 passed / 1 flaky (pre-existing analytics-redirect timing, retry-passed) / 1 skipped** · deployed `8dae570` → prod e2e **35 passed / 0 flaky / 1 skipped** · fresh local + production screenshot sets confirm every removal (`e2e/screenshots/`, gitignored) · prod reply-rate card reads 1.4% (288/20,184, 7d) vs old all-time 0.1%. Notes: stale `.next` dev types reference deleted routes after a route deletion — `rm -rf .next` before typechecking. Deploy-live detection: poll a new public asset (`/omnivate-mark.png` 404→200).

**⚠ OPEN RISK re-surfaced: `Omnivate-AI/omnivate-cockpit` is still PUBLIC** (first flagged 2026-07-03). Internal docs (client names, performance numbers, plan docs) are exposed. Needs Amzat/Omar: `gh repo edit Omnivate-AI/omnivate-cockpit --visibility private --accept-visibility-change-consequences`.
