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

### 2026-07-15 (later) — Phase 8 done (Alerts that behave like alerts)

Change list: **`docs/V2-PHASE8-ALERTS.md`**. All four deliverables on the shared `alerts-table.tsx` (used by BOTH the global `/alerts` page and the client Alerts tab — fixing one covered both).

- **Acknowledge = real state** (migration 019 added `acknowledged_at`/`acknowledged_by` to sp_infra_alerts + cockpit_alerts, appended to `vw_cockpit_alerts`). The ack route now stamps ack + KEEPS `status='open'` (was a hard-resolve, answer #8). UI: greyed, kept in an "Acknowledged & maintenance" collapsed group, timestamped. Every urgency count (`getAlertCounts` sidebar, `getTopAlerts` banner, `getGlobalAlertSummary` cards, `getClientAlertData.summary`, `getRecentAlerts`) now filters `.is("acknowledged_at", null)`. DB-proven (staged+reverted): ack kept the alert open, dropped needs-action 29→28, stayed visible.
- **Context routing** (`lib/alerts-presentation.ts alertContextRoute`): keyword-matched per type → Mailboxes / Overview(Ready Bank) / Placement. Inline "View X →" per row + in the detail panel.
- **Tier-aware severity** (`alertTone`): red only for actionable critical/high; amber warning; blue info; **neutral for ALL maintenance** regardless of raw severity — kills the 49 maintenance/high `warmup_needs_reconnect`(33)/`warmup_reapply_failed`(16) rows wearing red. Legend added.
- **De-verbose**: needs-action table first; acknowledged+maintenance collapsed below; resolved collapsed under that; summary cards kept.
- **GOTCHA:** `CREATE OR REPLACE VIEW` can't insert columns mid-list ("cannot change name of view column") — appended ack cols at the end of the view (cockpit reads SELECT *, so order is immaterial). Orphaned dead code confirmed unmounted: `alert-table.tsx` (singular, holds the disabled RotateButton), `resolved-section.tsx`, `dismiss-dialog.tsx` — the Phase-7-flagged dead RotateButton is here, so it's genuinely unreachable.

### 2026-07-15 — Phase 7 done (Mailboxes & orders: make actions real)

Ran under **ultracode**: a 7-agent understanding workflow (`wf_35c4991a`) mapped the mailbox tab, decisions model, retire/order wiring, warmup math, plugin execution, and live Supabase schema before any edit; a 6-claim × 3-skeptic adversarial safety workflow verified the retire/order flow before ship. Change list + Omar decisions: **`docs/V2-PHASE7-MAILBOX-ACTIONS.md`**. Plugin side: **email-infra PR #2** (`feat/retire-engine-phase7`).

- **Retire Domain** rewired off the disabled `/api/domains/drain` 410 stub onto the decisions model: button → `POST /api/clients/[slug]/retire-domain` raises a `retire_domain` sp_decisions row (pending, domain-scoped, deduped per domain) → approve in-app/Slack → **supervised `retire-engine.mjs`** drains the domain (cap 0 + warmup off, kept in campaign; catch-all→master; tags retired; sp_domains→draining; InboxKit cancel deferred +30d to process-due-cancels; decision→executed). Flag `infraRetireDomain` on (raising is non-destructive; execution supervised). `summarizeDecisionPayload` + per-domain pending badge widened to the new type + the cockpit's `pending` status. **Staged proof:** approved decision #118 (cylindo clearcylindo.com, 2 boxes) → `retire-engine --dry-run` resolved boxes + live InboxKit domain uid + master catch-all + full plan, zero writes; superseded.
- **Request Order un-stranded** (audit mismatch-risk #2): `order-engine.mjs` now honors a cockpit `manual_request` regardless of the reserve gap (orders ≥1 2-box domain, marked manual-origin through to Slack + sp_orders). **Staged proof:** AP gap=0 → "honoring despite healthy bench" → proposes 2 boxes/$18.48 (was "leaving as-is" = stranded).
- **Domain Health chart** → `getClientDomainHealthBands`: weakest-domain (min) + p25/median band + at-risk-domain count (right axis) + explicit "all healthy" banner. The old unweighted pool mean hid dead boxes — **AP shows avg 99.2 while one box is at warmup 0.0; Cylindo 99.4 with a 71 box** (confirmed live).
- **Warmup weighting** (`getClientLifecycleHistory` portfolio.ts): the parent-slug `(a+b)/2` (comment literally "weighted-enough") → mailbox-count-weighted grand mean via `Σ(avgᵢ·totalᵢ)/Σtotalᵢ` (view's `avg_warmup` is already a true per-mailbox mean per slug). Single-slug clients were already correct. The **Lifecycle & Health History** dual-axis mash split into two charts (lifecycle-mix stacked areas + weighted-warmup line & at-risk bars).
- **Domain drill-down**: `lifecycle-breakdown.tsx` is now a client component; clicking a lifecycle state reveals its per-domain list (box count, worst+median warmup, tags, age), derived from the inventory the tab already loads (AP/PayCaptain domains aren't reliably in sp_domains, so everything derives from mailboxes).
- **Dead-backend audit:** Mailboxes tab now has no button hitting a dead endpoint. `RotateButton` on the **Alerts** tab still hits the disabled `/api/rotate-domain` — deliberately left for **Phase 8** (alerts actions). `burnt-domains-list.tsx` is orphaned (unmounted) dead code. Orders scope label already shipped Phase 3.
- **Adversarial safety verify** (retire cancels real billing): 6 claims × 3 skeptics prompted to refute → **all 6 held, 0 broken**. The one dissent (TOCTOU on approval-revert + null-`approved_by`) was hardened: retire-engine re-reads the decision immediately before the drain and refuses unless still `approved` AND with a recorded `approved_by`. Both branches proven drain-safe (nonexistent-domain decision).
- **GOTCHA:** the warmup view defs (`vw_cockpit_domain_health_daily`, `vw_cockpit_lifecycle_daily`) live only in Supabase (applied via Management API, NOT in committed migrations) — confirmed via `pg_get_viewdef`. domain_health_daily is per-domain avg-over-boxes; lifecycle_daily.avg_warmup is a true per-mailbox mean. The naive average-of-averages also exists in 3 stat-card spots in clients.ts (getClientStats/Breakdown/HealthTrend) — not the two Phase 7 charts, left for a follow-up.

### 2026-07-14 (late night) — Phase 6 done (Ready Bank truth, client by client)

Migration 018 applied live + verified; the reconciliation table + gap list live in **`docs/V2-PHASE6-READY-BANK-GAPS.md`** (Omar's ops decisions: PayCaptain qual pass or "by design", undecided backlogs, ~18.5k uploaded-never-emailed recycle cohort, Omnivate schema, Cylindo ledger drift).

- **Reconciliation method:** per client, one query joining `v_{slug}_tam` to `v_{slug}_actually_emailed` (live view: send events ∪ repliers ∪ hist floor, emails pre-lowered) comparing OLD lines (uploaded-flag) vs NEW (emailed). Uploaded overstated contact on every client: AP +3,730 · Cylindo +6,084 · PayCaptain +3,835 · Omnivate +4,874. Cylindo three-way check also caught the LEDGER column (`smartlead_emailed` 17,683 vs live 20,120) undercounting — the cockpit reads the view, but flag it to the ledger project.
- **Qualified truth:** AP 54,480 (11,495 undecided) · Cylindo 22,918 (21,966 undecided — TAM already fit-gated by `fit_reach_out`, so the plan's "28k" measures 22k post-gate) · PayCaptain **193 of 92,967 = never ran → NULL** · Omnivate **no column → NULL**. `cockpit_ready_bank_daily.qualified` dropped NOT NULL/DEFAULT; NULL = "Not tracked" end-to-end (fn → query type `number | null` → null-aware parent aggregation → card).
- **Card** (`ready-bank-card.tsx`): "In campaigns" → **"Emailed"**; the 5% client-side guess is gone; the split bar gained an amber **uploaded-never-emailed** segment (computed as verified − emailed − available); a `<details>` ⓘ block explains every line per client (QUALIFIED_NOTES keyed by slug). "Available" hero = verified AND never emailed AND not uploaded (conservative — queued leads not counted).
- **Fn design:** same per-client EXCEPTION-guarded blocks; the actually-emailed JOIN runs in the daily 09:12 UTC cron (~seconds; Cylindo TAM 45k × aggregated events was fine interactively). Snapshot repopulated same-day; values matched the reconciliation exactly (AP emailed 23,685 vs 23,681 measured minutes earlier = live events landing — the view is genuinely live).
- CC `ready_leads` (client summary "Ready" line) inherits the conservative availability automatically via `readyBank.available_email` — no CC code change.

### 2026-07-14 (night) — Phase 5 done (charts & campaigns restructure + graph overhaul)

Commit `0f84a40`, deployed + prod-verified same evening as Phase 4 (plan explicitly allows 4+5 pairing). **Omar-facing change list: `docs/V2-PHASE5-CHART-CHANGES.md`** — 8 judgment calls flagged for his review per the acceptance criteria.

- **Overview suite** (`components/clients/overview-performance.tsx`): ONE range selection (presets + Phase 4's custom picker) drives KPI cards + the confirmed three charts — sends-vs-target (weekday-stepped target line via `getTargetForDate`; red under-target / gray weekend bars), reply-rate trend (TOTAL replies ÷ sends per day, header shows period avg + pp delta vs preceding equal period, hovercard = that day's sends/replies/rate, zero-send days bridged), positive replies count. All client-side filtered from ONE 365d `getClientPerformanceHistory` fetch — instant switches, and the overview dropped from 9 queries to 6.
- **Deleted** (superseded): `mini-send-chart` / `send-reply-chart` / `replies-chart` / `performance-metrics` components + the dead query fns (`getClientRecentHistory` / `getClientSendReplyHistory` / `getClientReplyHistory` / `getClientAnomalyHistory`, ~150 lines).
- **Campaigns tab**: Type dropdown → real sections. Active = primary only (emerald) · Follow-up (sky, "reply-triggered — low volume by design") · Referral (violet) · Past unchanged. Sort inside sections stays worst-health-first.
- **Compare dialog**: side-by-side Inbox Placement panel (latest test per campaign — colored bar + % + test date; `/api/campaigns/{id}/detail` already returned `placement`, the dialog was dropping it). The overlaid day-by-day sends (delta-from-lifetime) + positive-reply-rate lines were verified correct as-built.
- **Placement trend**: single-test campaigns render as a big dot + "(1 test)" legend suffix; the whole-chart 2+ gate is now ≥1 (empty state only for zero tests in-window). Null/0-seed rows were already dropped in Phase 3.
- **Scope note**: the `/compare` PAGE kept its 14d charts — this phase's compare deliverable was the campaign comparison dialog; flagged in the change list as an open offer.
- Local e2e 35 passed / 3 expected skips on the final build; prod suite re-run + fresh screenshots after deploy. One `fetch failed` in the local server log = the documented box-level DNS flake in auth middleware (not an app bug, absent on Vercel).

### 2026-07-14 (evening) — Phase 4 done (make it feel alive)

Commit `1f6fa9d`, deployed + prod-verified. **Acceptance measured on production, from the browser's own mousedown to the pressed-state paint** (`e2e/feedback-timing.spec.ts`, `MEASURE=1` opt-in):

| Interaction | BEFORE (prod) | AFTER (prod) | Target |
|---|---|---|---|
| Client tab click | 2,714–4,377 ms | **4–13 ms** | <100 ms |
| CC range switch | 1,544–1,783 ms | **4–10 ms** | <100 ms |

- **Architecture (answer #14):** `clients/[slug]/page.tsx` renders ONLY the active tab (validated `?tab`) inside `<Suspense>` with a per-tab skeleton — inactive tabs run zero queries (Mailboxes' eleven no longer tax every click; placement results moved into the Placement tab). `ClientTabs` is pure navigation with TWO optimistic states at different priorities: pressed flip commits urgently (same-frame paint), the chart-heavy body→skeleton swap runs inside the transition (recharts unmounts cost 100–300 ms and were holding the paint hostage when done in one commit). Same pattern for the CC range switch (`RangeTransitionProvider` + `RangeVeil` dim exactly the range-scoped regions).
- **Custom date range:** from–to picker beside the This Week/Month/All presets (`?from`/`?to`, server-validated), driving the performance KPIs with a "Custom" pressed chip + vs-preceding-equal-period trends; history fetch widens to cover the range (cap 365d). Charts follow in Phase 5 per the plan's own wording ("extended to respect the selected range and date picker" is listed under Phase 5 chart 1).
- **Route skeletons:** CC `loading.tsx` refreshed to the post-Phase-1 layout (was 6-KPI + sync-panel shaped); client `loading.tsx` mirrors the real tab set and reuses the same `TabSkeleton`. All other routes verified covered (`analytics/*` are pure redirects, no skeleton needed).
- **GOTCHA (cost ~40 min):** exporting a function from a `"use client"` module and CALLING it in a server component passes tsc AND `next build`, then throws at runtime ("Attempted to call isTabValue() from the server") — and the e2e suite ran 18 min with 8 tests silently missing while pages error-boundaried. Registry now lives in `components/clients/tab-config.ts` (plain module); client-tabs re-exports the TYPE only. If a future e2e run's passed+skipped count doesn't sum to `npx playwright test --list`'s total, treat it as a broken build, not flake.
- **Measurement gotcha:** clock from arm-time billed Playwright's click actionability machinery (~150–400 ms) to the app — the spec measures from the element's own `mousedown`. The BEFORE numbers are unaffected at seconds scale.
- Local e2e on the final build: 35 passed / 3 expected skips (2 MEASURE-gated, 1 SCREENSHOTS-gated), 2.1 m. Prod suite re-run post-deploy green (see log `e2e-prod-full.log` note in commit).

### 2026-07-14 (later) — Phase 3 done (fix the math, definitions, links + backfill)

Executed the full fix list from `V2-AUDIT-FINDINGS.md` the same day as the audit; the resolution table (per-RC status + re-verification) lives in that doc. Highlights + operational notes:

- **Three repos, three vehicles:** cockpit direct on main (`c1702ff`, deployed + prod-verified); sync fixes as smartlead-perf-plugin **PR #4** (branch `fix/v2-audit-rc1-rc2-rc9`); rotation fix as email-infra-plugin **PR #1** (branch `fix/rotation-max-email-per-day`, based on `phases-4-8-ordering-adoption`). Both PRs await Amzat's merge — the *data* fixes are already live (migrations 017 cockpit + 023 perf applied via Management API; backfills run; 300-box cap-column correction executed + logged).
- **Acceptance proof:** post-backfill window re-check vs the audit's live Smartlead pulls — Cylindo 7/14/30d exact on all nine numbers; AP exact on sends+positives, replies +1 (arrived after the baseline). 26/26 conversation links resolve to the correct lead (was 0/26). Production screenshots confirm: CC "Positive Replies" card w/ definition, date-anchored "(Mon 13 Jul)" labels, Cylindo header 1.4% total-reply rate (was 0.1% interested rate), "187 Mailboxes (65 sending)", tab renamed, Daily Limit 25 on AP active boxes.
- **Gotchas for future sessions:** `/campaigns/{id}/leads?email=` 400s (Joi) — use `?lead_category_id=` pages; `GET /master-inbox/{leadMap}` response carries `lead_email`/`email_lead_id`/`email_lead_map_id` (NOT nested `lead.email`); port 3000 is squatted on this box — `next start -p 3210` + `BASE_URL` for local e2e (playwright.config has NO webServer — start the server yourself); prod e2e takes ~50 min (fine). Backfill: 156/2,780 pulls failed (38 = Smartlead-deleted campaigns 3514575/3573970 → still rows in sp_campaigns, cleanup candidate; ~118 transient DNS on near-zero followups — daily trailing re-sync self-heals).
- **Capacity semantics decision:** `estimated_max_capacity` (and the client-page gauge) now = Σ synced `daily_send_limit` over active/resting/reserve/warming = "what current caps allow/day" — bench boxes carry cap 0 until deployed, so AP reads 1,500 (not the old intent-column 4,190). Gauge relabeled "allowed/day"; rotation-card reserve row can legitimately show "97 boxes · 0/day". Phase 7's drill-down owns any richer potential-capacity story.
- **Positive-replies canonicalization:** counts surfaces = `sp_campaign_leads` current category (Int + HAR); trend charts stay on daily-facts positives (now converging via trailing re-sync). KPI card, client cards, tab all labeled with the definition. Note lifetime `campaign_lead_stats.interested` ≈ Int+HAR natively, so the header's all-time interested number needed no source change — only labels.
- **OPEN with Omar (docs/V2-PHASE3-OMAR-QUESTIONS.md):** OrbitalX track-or-retire (its unsynced state also fires a daily false send-floor alert); PayCaptain/Cylindo/Omnivate target+floor values. Plus the standing Pipeline-tab question from the requirements doc.

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
