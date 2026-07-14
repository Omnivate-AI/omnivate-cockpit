# V2 Phase 2 — Numbers Audit Findings

**Run:** 2026-07-14 (Amzat + Claude) · **Read-only — no code or data was changed.**
**Scope:** every Phase 2 checklist item, verified fresh against Supabase (project `uivgowblojtyiobhgjlv`, via Management API) **and live Smartlead** (production API key), on **Acceleration Partners** (Smartlead client 408744) and **Cylindo** (320846), for 7 / 14 / 30-day windows. Prior validations were treated as hints only.
**Method:** for every surface, three layers were compared — (1) what the cockpit query/view computes, (2) an independent SQL recomputation from the `sp_*` tables, (3) a live pull from the same Smartlead endpoints the sync uses (`/campaigns/{id}/sequence-analytics` per day and per window, `/campaigns/{id}/analytics` for lifetime, SmartDelivery per-seed reports for placement, `/master-inbox/{id}` for link resolution). 60 campaigns swept, ~700 live API calls, zero write operations.

---

## TL;DR

The **send numbers are trustworthy everywhere** — every synced day matches Smartlead exactly, for both clients, across all windows (Cylindo 7/14/30d deltas: 0/0/0). The problems cluster in four places:

1. **Time is modeled wrong at the edges** — the sync deliberately skips weekend dates and never revisits a day once written, so late-arriving replies (5–7% of replies) and late categorizations (**24–31% of "interested"**) are permanently missing, weekend activity is invisible, and the Command Center shows **all zeros every Sunday and Monday** on the "Yesterday" range.
2. **"Interested"/"reply rate" means three different things** on different surfaces, and the surface Omar uses to reach interested leads (the tab) undercounts Cylindo by ~60%.
3. **Every conversation link is broken** — 26/26 tested resolve to nothing. Failure mode pinned exactly (wrong id namespace), fix proven live.
4. **Mailbox capacity/limits read a stale engine column** — the weekly rotation flips real Smartlead limits but not `sp_mailboxes.max_email_per_day`, so capacity views and the Daily Limit column invert reality after every Monday swap.

Verdicts: **14 ✅ · 12 🟡 · 8 🔴** across the checklist. Every 🔴 has a root cause and a Phase 3 fix below. Nothing found suggests the underlying Smartlead data or the send pipeline is wrong — the sync's send capture is exact; the gaps are in *when* we sync, *what we call things*, and *which column/id we read*.

---

## Verdict matrix

| # | Checklist item | Verdict | Evidence (2026-07-14) |
|---|---|---|---|
| 1a | Command Center KPI — **emails sent** (all ranges) | ✅ | Per-day facts = Smartlead exactly on every synced day, both clients. Cylindo window deltas 0/0/0 (7/14/30d). AP deltas +69/+120/+133 are entirely weekend sends (see 🔴 RC-2), not sync error. |
| 1b | Command Center KPI — **total replies** | 🔴 RC-1 | DB undercounts vs live Smartlead: AP 7d 134 vs 141, 14d 220 vs 231, 30d 378 vs 393; Cylindo 7d 95 vs 96, 14d 146 vs 153, 30d 323 vs 336 (−5…7%). |
| 1c | Command Center KPI — **interested (positive) replies** | 🔴 RC-1 | AP 30d: DB 16 vs live 21 (−24%). Cylindo 30d: DB 34 vs live 41 (−17%); 14d: 24 vs 28. Positives also drift *down* (AP 07-10: DB 2, live 1 — categories are mutable). |
| 1d | KPI reply-rate arithmetic | ✅ | `total replies ÷ period sends ×100`, range-scoped (Phase 1 fix confirmed live in code). Inherits 1b's undercount, so the ratio is slightly low — fixed by RC-1. |
| 1e | "Is today really from the database" | ✅ + 🔴 RC-3 | Confirmed DB-only: facts end at the last business day (today never appears; live send events exist but don't feed KPIs). **But** on Sundays and Mondays the "Yesterday" range (`snapshot_date ≥ today−1`) matches zero rows → all four KPI cards and every client card show **0** (sends bar red 0/target) until Tuesday ~07:45. |
| 2a | Client header — lifetime sent | ✅ | AP 23,038 vs live 23,039 (+1 sent after the 07:45 sync); Cylindo 77,417 vs 78,919 (delta = today's live sending). Freshness ≤ 1 business day, by design. |
| 2b | Client header — "reply rate" | 🔴 RC-4 | `all_time_interested ÷ all_time_sent` (AP 0.14%, Cylindo 0.13%) — the **same all-time formula Omar flagged**, fixed on the Command Center in Phase 1, still live on the client header, the client summary card, and the digest. Fed into `replyRateColor` whose red threshold is <1% → shows red permanently on every client. |
| 2c | Client header — mailbox count | 🟡 | = all non-retired boxes (AP 200, Cylindo 187) including reserve/parked/warming; reads as "sending fleet" but only 50/65 are active senders. Label fix. |
| 3a | Sends vs Target — sends side | ✅ | Period sums verified (see 1a). |
| 3b | Sends vs Target — target side | 🔴 RC-5 | Multi-day ranges multiply the daily target by **calendar** days while facts exist only for weekdays: AP 7d = 7,304 ÷ (1,500×7) = 70% amber, though weekday attainment was ≈97%. Card also ignores the `daily_targets` weekday JSON (PayCaptain bar uses 1,200 base; the chart's target line uses 3,000 via `getTargetForDate` — two targets for the same pixel row). |
| 3c | Two target concepts (config target vs plugin send-floor) | 🟡 | AP consistent (1,500 = 1,500). PayCaptain inconsistent (config base 1,200 vs weekday JSON 3,000 vs floor 3,000). **Cylindo floor is NULL** → send-floor alert silently disabled. OrbitalX floor 1,200 but not synced at all (see RC-8). Needs per-client reconciliation, not code. |
| 4a | Lead runway — the math | ✅ | `vw_cockpit_client_runway` recomputed exactly: AP `4,657×1 + 17×0 = 4,657 ÷ 1,500 = 3.10d`; Cylindo `6,565×2 + 1,890×1 + 0×2 + 1×1 = 15,021 ÷ 1,950 = 7.70d`. Primary-only scoping + `considered_done` exclusion verified in the view SQL. Note the model treats every in-progress lead as having seq−1 emails left (upper bound — documented, acceptable). |
| 4b | Lead runway — capacity denominator | 🟡 RC-6 | Three capacity numbers exist: plugin facts 1,500/1,950 (used by runway — matched Monday's real throughput), live Smartlead active-group limits 1,250/1,700, and `vw_cockpit_client_capacity` 250/700 (stale column, see RC-6). One source needed. |
| 4c | Gauge scaling / colors | ✅ | Fill = days ÷ max(2×warning, 30), capped; colors by per-client 7/3 thresholds (AP 3.10d → amber ✓, Cylindo 7.70d → green ✓). Ready-Bank gauge renders the 999 "not tracked" sentinel honestly as a lead count. `sp_daily_campaign_facts.runway_days` is NULL on all 95 rows, so the per-campaign MIN fallback never fires today (fragile but currently safe). |
| 5 | 7-day sends chart, day by day | ✅ + 🔴 RC-2 | Every plotted weekday bar = Smartlead exactly. But Sat/Sun **days are absent from the axis entirely** (no rows are ever written), and AP genuinely sent 67 emails on 07-11/07-12 (64 of them from the primary) — invisible. Target line correctly uses `getTargetForDate` incl. weekday JSON. |
| 6a | Campaign cards (lifetime stats, reply rate) | ✅ | Lifetime per campaign verified vs live `/analytics` — only same-day drift (e.g. AP referral standalone 16→17 sends; interested 30→29 after a live recategorization). One same-day status drift (3574347 ACTIVE in DB, COMPLETED live since the 07:45 sync) — freshness, not error. |
| 6b | Campaign detail daily-sends series ("issue with getting daily sent") | 🟡 RC-2 | Diagnosed, three benign causes: (1) weekday-only rows → weekend gaps in every series; (2) facts begin 2026-06-09 (plugin go-live) → campaigns older than that have a truncated window; (3) paused/completed campaigns correctly report 0-send days. Sends per synced day are exact — nothing is *wrong* with the data that exists. |
| 7a | Provider performance — sender split (14d) | ✅ | `vw_cockpit_provider_daily` sends reconcile **exactly** with campaign facts for AP (10,060) and Cylindo (9,640); PayCaptain −105 (0.8%, events-derived vs sequence-analytics). Replies within 1–6 of campaign facts (independent derivation). |
| 7b | Provider performance — recipient split coverage | 🟡 | Populated for AP / Cylindo / PayCaptain (MX-classified send events). Omnivate = all zeros (no sends in window — honest). **OrbitalX absent entirely** (RC-8). Panel should say "no capture" instead of rendering empty. |
| 8 | Inbox placement | ✅ + 🟡 | Independent per-seed recompute of test 433660 (AP primary): 5,929 Inbox + 3 Spam of 5,932 = **99.95 / 0.05 — matches the stored row exactly**. The flat ~100% line is real data **and** flat by construction: each dated row snapshots the test's **cumulative all-runs aggregate** (5,932 seeds ≈ 45 runs), so new runs barely move it. AP Referral Standalone now has 3 dated rows (a line can draw); the general 1-point-no-line failure stands (Phase 5 dot fix). One null/0-seed row exists (Cylindo Design Studios 07-02, `inbox_pct` NULL, 0 seeds) — the trend chart must skip it, not plot 0. |
| 9a | Mailbox reply rates | ✅ | 5/5 spot-checked AP boxes recompute exactly (e.g. 6÷245 = 2.45%). |
| 9b | Mailbox spam rate | 🟡 | NULL for all AP boxes (no `sp_placement_mailbox_summary` rows for them — the workspace-aggregate SmartDelivery endpoint covers only some clients). Renders as "—"; needs an explicit "no test data" affordance, not a bug. |
| 9c | Mailbox **daily limit** + capacity views | 🔴 RC-6 | `sp_mailboxes.max_email_per_day` is the **engine-intent column and it did not flip in the Monday 07-13 rotation swap**: AP active Group A shows 5/day (real Smartlead limit: 25), resting Group B shows 30 (real: 5). Live-verified via `/email-accounts/18608633` (25/day) vs the column (5). Everything that reads it inverts reality after every swap: Daily Limit column, `vw_cockpit_client_capacity` (AP 250 vs real 1,250), `vw_cockpit_rotation_capacity` group capacities. The synced `daily_send_limit` column IS correct. |
| 9d | Domain health values / chart | ✅ | Warmup values real (AP avg 100.0, Cylindo 99.15); flat-100 = healthy pool averaged, as diagnosed in the plan (Phase 7 redesign). |
| 9e | Lifecycle history + avg-warmup aggregation | 🟡 | `sp_mailbox_daily` runs every day (incl. weekends) but only since **07-03** → 12 days of history depth. Health-summary view hardcodes `draining: 0` while Cylindo has 2 real draining boxes → category counts (185) don't sum to total (187). Portfolio parent rollup still uses an unweighted pairwise mean (`portfolio.ts:125-142`) — confirmed unfixed, already queued for Phase 7. |
| 10 | Orders page | ✅ + 🟡 | Spend semantics verified against `sp_orders`: spent = completed only (10 × $18.48 = $184.80, reconciles with the known June InboxKit history: $18.48 smoke + $166.32 scale batch); failed (22) and superseded (1) charge $0 ✓; awaiting-approval rows are projections (Cylindo $462 + $332.64, Omnivate $351.12) ✓. 🟡 scope: only orders placed through this system (post 2026-06-15) — the original client pools aren't in it; the page should say so. |
| 11 | Audit log vs source | ✅ + 🟡 | Rows map 1:1 to `sp_actions_log` (weekly_rotation ×3 on 07-13 09:33–09:41 — the swap that triggered RC-6 — is right there). 🟡 engine-level rows (order_engine, daily_routine, weekly_rotation) carry NULL client/domain/description → near-empty table rows with a self-link (see 15c). |
| 12 | Compare page | ✅ + 🟡 | Same verified perf view; ×100 correct. 🟡 its "reply rate" = **positive** replies ÷ sends, while the CC KPI is **total** replies ÷ sends and the header is all-time interested ÷ sends — three semantics under one label (RC-4). Mailbox-health series = unweighted avg of domain averages. |
| 13 | Digest vs Command Center | 🔴 RC-7 | Quantified on today's data: digest header "Reply Rate" = all-time interested ÷ all-time sent = 217 ÷ 194,918 = **0.11%** vs CC **1.45%** (7d) / 1.94% (1d). Digest "Total Replies" = lifetime **2,835** rendered beside "Sent" **5,510** (latest day). Per-client sent = latest business day only regardless of anything. Confirms the two-code-paths risk; Phase 9 merges them. |
| 14 | Interested counts, both definitions | ✅ (counted) | See table below. Bonus finding: Smartlead's own `campaign_lead_stats.interested` ≈ Interested **+ human_action_required** (AP 22+12 rows ≈ 33; Cylindo 96+4 ≈ 101) — Smartlead already agrees with decision #1's definition. |
| 15a | Conversation links (Tyler Lopez) | 🔴 RC-9 | **26/26 sampled links dead.** Failure mode pinned: the URL passes `smartlead_lead_id` as `?leadMap=`, but leadMap is a **campaign_lead_map_id** — a different id namespace. Tyler: stored 3994236691 is his genuine *lead* id (global `/leads?email=` returns it) but `/master-inbox/3994236691` → empty; his true map id **3244548229** resolves to his exact conversation (last_reply 2026-07-06 17:49:50 = his sp_replies row to the second). No wrong-conversation collisions found (links are dead, not misleading). |
| 15b | Campaign "View in Smartlead" links | ✅ | All 60 AP+Cylindo `smartlead_campaign_id`s are real, live campaigns (0 errors across the sweep); URL is the standard app path. |
| 15c | Audit-table domain links | 🟡 | Internal links to `/clients/{client}?tab=mailboxes` — fine when client is set; NULL-client engine rows render an empty self-link cell. Cosmetic. |
| 16 | Interested Leads tab | 🔴 RC-10 | Tab = webhook-era `sp_replies` with `lead_category_name='Interested'` only. Cylindo: tab shows **38** unique vs ~**92–96** current-category interested leads in Smartlead (webhook capture started long after its campaigns) — a ~60% undercount on the surface Omar uses to reach buyers. AP is fine (22 = 22, webhook wired from campaign start). Snapshot table = live view exactly (cron healthy). |

### Interested counts under every definition (2026-07-14)

| Client | Daily-facts positives (all-time sum) | Smartlead lifetime `interested` | Webhook replies: Interested | + human_action_required | Current-category leads: Int + HAR (unique) |
|---|---|---|---|---|---|
| Acceleration Partners | 21 | 33 | 22 | +9 → 31 | 22 + 9 = **31** |
| Cylindo | 40 | 101 | 41 | +2 → 43 | 92 + 3 = **95** |
| PayCaptain | — | 19 | 14 | +0 → 14 | — |
| Omnivate | — | 2 | 2 | +0 → 2 | — |

Three different "interested" sources power different surfaces today (KPI cards ← daily facts; header/digest/campaign cards ← lifetime; Interested tab ← webhook replies). The Phase 3 "Positive replies" rollout must also pick **one canonical per-lead source** — recommendation: `sp_campaign_leads` current category ∈ {Interested, human_action_required} (matches the Smartlead UI, includes pre-webhook history), with daily-facts positives kept only for *trend* charts.

---

## Root causes (every 🔴)

**RC-1 — One-shot daily sync never revisits a day.** `sync.ts` pulls `sequence-analytics(day, day)` once, the morning after. Replies keep arriving and categorizations keep changing for days afterwards (Smartlead attributes them back to the send-date window), but the row is never updated. Sends don't drift (verified exact); replies drift +5–7%, positives ±24–31%. Bucket: **sync gap**.

**RC-2 — Weekend dates are skipped by design.** `dates.ts::lastWeekdayBefore` assumes "outbound only runs on weekdays". False at the margins: AP sent 67 emails and received 2 replies on 07-11/07-12 (follow-ups + primary trickle). No row for a weekend date is ever written, ever. Also means every chart's x-axis silently jumps Fri→Mon. Bucket: **sync gap**.

**RC-3 — Calendar-day cutoffs against business-day facts.** `getGlobalKPIs`/`getClientSummaries` compute `cutoff = today − days` and filter `snapshot_date ≥ cutoff`. On Sun/Mon with `days=1` that window contains no fact rows → the Command Center reads all zeros for ~48 hours every week. Bucket: **cockpit definition**.

**RC-4 — "Reply rate" has three meanings.** All-time interested÷sent (client header, summary card, digest — the exact formula Omar already rejected); period total-replies÷sends (CC KPI, Phase 1); period positive÷sends (client charts, compare page). Also `replyRateColor`'s thresholds (red <1%) were calibrated for total-reply rates and are fed interested rates → permanently red. Bucket: **cockpit definition**.

**RC-5 — Sends-vs-Target target side is calendar-naive and ignores weekday targets.** `periodTarget = daily_email_target × periodDays` (calendar days, base target only). The facts are weekday-only and PayCaptain's real targets live in the `daily_targets` JSON that only the chart consults. Bucket: **cockpit definition**.

**RC-6 — `max_email_per_day` is engine intent, not truth, and the rotation doesn't maintain it.** The weekly rotation (ran 07-13 09:33) flips real Smartlead limits (verified live: active=25, resting=5 ✓) and lifecycle tags, but never updates `sp_mailboxes.max_email_per_day`. Every capacity/limit surface in the cockpit reads that stale column; the correctly-synced `daily_send_limit` column sits unused beside it. Bucket: **engine data gap (email-infra plugin) + cockpit reading the wrong column**.

**RC-7 — Digest runs on its own legacy code path** (latest-day sends + lifetime replies + all-time rate in one table). Known; Phase 9 retires it. Quantified above so the merge has a before/after. Bucket: **cockpit definition**.

**RC-8 — OrbitalX is active in `sp_clients` but absent from the sync's hardcoded `CLIENT_MATCHERS`** (`sync.ts:84` — only cylindo, paycaptain, acceleration_partners, omnivate). It has zero daily facts, zero mailbox syncs, zero reply capture; its lifetime rows were last touched by a one-off on 07-12. The cockpit therefore shows it as a live client with permanently-blank performance. 9 of its campaigns are PAUSED — the class that "keeps sending follow-ups", so real activity may be invisible right now. Bucket: **sync gap + ops decision** (track it properly or mark it inactive).

**RC-9 — Conversation links pass a lead id where a campaign_lead_map_id is required.** Proven end-to-end (matrix 15a). The map id is present in the same `/campaigns/{id}/leads` responses the category capture already pages — it just isn't stored. Bucket: **sync gap (missing column) + cockpit link template**.

**RC-10 — Interested Leads tab reads webhook-era replies with the narrow definition.** Pre-webhook interested leads (most of Cylindo's) and `human_action_required` never appear. Bucket: **cockpit definition** (source choice), fixed by the same canonical-source decision as item 14.

---

## Phase 3 fix & backfill list

Ordered; sync-side items go to `smartlead-perf-plugin` as a PR (its repo), engine item to `email-infra-plugin`, the rest are cockpit-side. Each maps to a root cause.

**Sync-side (smartlead-perf-plugin PR):**
1. **Trailing re-sync window (RC-1):** every run re-pulls `sequence-analytics` for the last 5–7 business days (upsert on `(campaign_id, date)` already exists) so late replies/categorizations converge. **Backfill:** one-off re-pull of all daily facts since 2026-06-09 for all synced clients (the sweep script pattern in `scratchpad/sl.mjs` does exactly this).
2. **Weekend capture (RC-2):** pull Sat+Sun rows too — either run the target-date loop over every calendar day since the last synced date, or have Monday's run pull Fri/Sat/Sun. Keep the Slack day-over-day comparison weekday-contiguous if desired — that's a presentation choice, the *data* should exist. **Backfill:** weekends since 2026-06-09 (covered by the same re-pull as #1 if it iterates calendar days).
3. **Store `campaign_lead_map_id` (RC-9):** add column to `sp_campaign_leads`, populate in `captureCampaignCategories` (the value is already in the paged rows), **backfill** via category-filtered `/campaigns/{id}/leads` pages (cheap — only categorized leads), and expose it through `vw_cockpit_interested_leads` + `fn_cockpit_snapshot_interested_leads`.
4. **OrbitalX decision (RC-8):** ask Omar — if OrbitalX should be live: add `{ slug: 'orbitalx', namePattern: /orbital/i }` to `CLIENT_MATCHERS`; if dormant: set `sp_clients.active=false` (removes it from the cockpit and daily Slack). Either resolves the blank-card state.

**Engine-side (email-infra-plugin PR):**
5. **Rotation maintains `max_email_per_day` (RC-6):** the weekly swap updates the column when it updates Smartlead. Cockpit-side belt-and-braces in #8.

**Cockpit-side:**
6. **Business-day-aware ranges (RC-3):** anchor "Yesterday" and all range cutoffs to `latest_fact_date` (from `vw_cockpit_freshness`) instead of the calendar: `days=1` → the latest fact date, labeled with it ("Mon, Jul 13"); `days=N` → the last N fact dates. Kills the Sun/Mon zeros and makes windows business-day-consistent.
7. **One reply-rate semantic per surface, labeled (RC-4):** client header + summary card → period total-reply rate (same as CC) with the range in the label; anywhere interested-based rates remain, label "positive-reply rate" and rescale `replyRateColor` per metric. Compare/client charts: label as positive-reply rate.
8. **Capacity + Daily Limit read `daily_send_limit` (RC-6):** switch `vw_cockpit_accounts.max_email_per_day`→`daily_send_limit` (or COALESCE preferring the synced value), same for `vw_cockpit_client_capacity` and `vw_cockpit_rotation_capacity`. Runway denominator: standardize on the same live-limits sum (and document the plugin-facts number as historical).
9. **Sends-vs-Target target side (RC-5):** periodTarget = Σ `getTargetForDate(d)` over the **fact dates actually in the window** — fixes calendar inflation and the ignored weekday JSON in one move. Separately reconcile per client with Omar: PayCaptain base 1,200 vs 3,000, Cylindo floor NULL.
10. **Positive replies rollout (decision #1, RC-10 + item 14):** canonical per-lead source = `sp_campaign_leads` current category ∈ {Interested, human_action_required}; KPI/period trends stay on daily-facts positives (post #1 they converge); Interested tab rebuilt on the canonical source (join `sp_replies` for reply timestamps where present, else `category_synced_at`), definition labeled in the UI.
11. **Conversation links (RC-9):** template `?leadMap={campaign_lead_map_id}`; render plain text (no link) when the map id is null (pre-backfill rows).
12. **Small view fixes:** health-summary counts `draining` (categories must sum to total); placement trend skips null/0-seed rows; orders page label "orders placed via this system (since Jun 2026)"; audit table renders "—" instead of an empty self-link when client is null; digest header rate → range-scoped (interim only — page dies in Phase 9); fix `client_analytics_config.is_active=false` for acceleration_partners (latent — app reads `sp_clients.active`, but the flag will bite anything that trusts config).

**Explicitly verified good — do not touch in Phase 3:** send capture and per-day sends (exact), lifetime campaign stats (≤1-business-day freshness), runway arithmetic and scoping, placement values (per-seed recompute matched), mailbox reply-rate view, orders spend semantics, ready-bank snapshot cadence (daily incl. weekends), interested snapshot ↔ live view consistency, campaign View-in-Smartlead links, provider sender-split reconciliation.

---

## Appendix — key evidence

**Window comparison (live Smartlead, exact cockpit windows `today−N … yesterday`, pulled 2026-07-14):**

| Client | Window | SL sent | DB sent | Δ | SL replies | DB replies | Δ | SL pos | DB pos | Δ |
|---|---|---|---|---|---|---|---|---|---|---|
| AP | 7d | 7,373 | 7,304 | −69 | 141 | 134 | −7 | 2 | 2 | 0 |
| AP | 14d | 10,180 | 10,060 | −120 | 231 | 220 | −11 | 9 | 5 | −4 |
| AP | 30d | 15,047 | 14,914 | −133 | 393 | 378 | −15 | 21 | 16 | −5 |
| Cylindo | 7d | 6,413 | 6,413 | 0 | 96 | 95 | −1 | 15 | 14 | −1 |
| Cylindo | 14d | 9,640 | 9,640 | 0 | 153 | 146 | −7 | 28 | 24 | −4 |
| Cylindo | 30d | 22,403 | 22,403 | 0 | 336 | 323 | −13 | 41 | 34 | −7 |

AP's send deltas = weekend sends (67 on 07-11/12 within 7d) + earlier weekends — i.e. RC-2, not sync error.

**Fact-date coverage (35-day scan):** every Sat + Sun since 2026-06-09 has zero fact rows; every weekday has 64–95 rows. Sync-run log confirms daily runs (Tue–Sat + Mon targeting last weekday; transient DNS failures on 07-06/07-08/07-10 all recovered on retry).

**Link test:** 26 interested-lead links (AP 12, Cylindo 14) → `GET /master-inbox/{stored_id}` = 26× `{"ok":true,"data":[]}` (dead), 0 wrong-conversation. Control: Tyler Lopez true map id 3244548229 → his conversation, category Interested, `last_reply_time` matches `sp_replies.received_at` exactly. Id namespaces: lead ids ≈ 3.92–4.11 B, map ids ≈ 3.18–3.24 B.

**Capacity inversion (live-verified):** AP active Group A: engine column 5/day vs Smartlead 25/day (box 18608633 checked individually); resting Group B: column 30 vs Smartlead 5. Cylindo mirror-image. Rotation executed 07-13 09:33–09:41 per `sp_actions_log`.

**Placement recompute:** test 433660, 5,932 seeds → 5,929 Inbox / 3 Spam = 99.95 / 0.05 (DB row identical). Row is the cumulative all-runs aggregate (runs 25 and 45 snapshots identical) — flat line by construction.

*Scratch artifacts (sweep JSONs, comparison scripts) live in the session scratchpad; the sweep pattern worth keeping is the trailing re-pull in `sl.mjs` — Phase 3's backfill can reuse it.*
