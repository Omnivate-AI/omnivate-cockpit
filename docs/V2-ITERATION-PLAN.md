# Omnivate Cockpit — V2 Iteration Plan

**Source:** Omar's full-app walkthrough review, received 2026-07-11 · **Owner:** Amzat (execution: Claude) · **Repo:** `Omnivate-AI/omnivate-cockpit` · **Live:** https://omnivate-cockpit.vercel.app
**Status:** PLANNED — no V2 work started yet. V1 (R1–R12) is complete and live; its record stays in `docs/EXECUTION-PLAN.md`.

---

## How to use this document (multi-session protocol)

This iteration is designed to run across multiple Claude sessions, each starting from a fresh context window. The rules:

1. **Start every session with:** `cd C:/Users/HP/omnivate-cockpit && git pull`, then read this file top to bottom. It is the single source of truth for V2.
2. **One phase per session** (Phases 4+5 or 6+8 can pair up if the session has room). Do not start a phase mid-session if the context window is already heavy — stop, update the log, and let the next session take it fresh.
3. **Before ending any session:** update the Progress Tracker below, write 2–5 bullet findings into the phase's **Log**, commit and push. The next session must be able to resume from this file alone.
4. **Nothing ships unverified.** Every phase ends with: `tsc` clean → `next build` green → e2e relevant suites green → deployed → checked on production.

**Copy-paste kickoff prompt for each session:**

> Read `docs/V2-ITERATION-PLAN.md` in `C:/Users/HP/omnivate-cockpit` (git pull first). Execute Phase N end to end, following the session protocol at the top of that doc. Update the tracker and phase log before finishing, then commit and push.

---

## The review in one paragraph

Omar went through every page. His feedback boils down to four themes: **(1) Trust the numbers** — verify everything visible against Smartlead, find where any mismatch enters the pipeline, and backfill where the database is wrong. **(2) Cut the clutter** — remove the banners, badges, duplicate cards and half-meaningful scores; keep only what someone acts on. **(3) Make it feel alive** — every click should respond instantly with a loading state; today the app feels frozen for seconds after clicking a tab or range. **(4) Finish the actions story** — buttons like Retire Domain must actually work (safely, through the email-infra plugin's approval model), and alerts should behave like a real notification system (acknowledge greys out, resolve routes you to the fix).

A lot of his "verify this" items were already independently validated on 2026-07-08 (`docs/DATA-ACCURACY-VALIDATION.md`) — runway math, rotation capacity, Ready Bank arithmetic, 7-day KPIs all recomputed exact. What's genuinely new in this review: the reply-rate card semantics, the interested-replies definition, a handful of dead/broken actions, the interactivity problem, and the Ready Bank per-client truth question (which we knowingly deferred until "after this feedback round" — that round is now here).

---

## Progress tracker

| Phase | What | Size | Status |
|---|---|---|---|
| 1 | Declutter, branding, dead-button removal | 1 session | ☐ Not started |
| 2 | The numbers audit (read-only, vs Smartlead) | 1 session | ☐ Not started |
| 3 | Fix the math, definitions, links + backfill | 1–2 sessions | ☐ Not started |
| 4 | Make it feel alive (loading states, date range) | 1 session | ☐ Not started |
| 5 | Charts & campaigns restructure | 1 session | ☐ Not started |
| 6 | Ready Bank truth, client by client | 1 session | ☐ Not started |
| 7 | Mailboxes & orders — make actions real | 1–2 sessions | ☐ Not started |
| 8 | Alerts that behave like alerts | 1 session | ☐ Not started |
| 9 | One home: merge Digest into Command Center + final QA + Loom | 1 session | ☐ Not started |

**Suggested schedule at sprint pace:** Day 1 → Phase 1 + start Phase 2 · Day 2 → finish 2 + Phase 3 · Day 3 → Phases 4 + 5 · Day 4 → Phases 6 + 8 · Day 5 → Phase 7 · Day 6 → Phase 9 + record the Loom. Roughly six working days.

---

## Straight answers to the questions Omar asked

We traced every "what does this mean?" in the review to code before writing this plan. Answers, so nobody re-investigates:

**1. The "32" next to Acceleration Partners.** It's a composite **health score** (0–100), not an alert count. Five ingredients weighted 20% each: mailbox health, send adherence, reply rate, inbox placement, alert penalty. The ring turns red below 50. The problem: on the client cards, two of the five ingredients (mailbox health, placement) aren't wired and silently default to "neutral 50" — so the score is half-blind. **Verdict: remove it.** It's opaque, partially fake, and duplicates what the real cards below already say. (If we ever want a health score back, we rebuild it with complete inputs and an explanation on hover.)

**2. The red bar on the client card.** That's the **Sends vs Target** progress bar — it goes red when yesterday's sends were under 50% of the client's daily target, amber under 100%, green at/over target. This one is meaningful; it stays. The audit (Phase 2) verifies both numbers behind it.

**3. The "critical / warning / LD" labels.** The actual vocabulary in the system is: severity `critical`/`high` (renders red), `warning`/`medium` (amber), `info`/`low` (blue) — "LD" doesn't exist anywhere; it was almost certainly "**Low**" on screen. On top of severity there's a second axis, **tier**: `actionable` (counts in every top-line number) vs `maintenance` (background noise, excluded). This taxonomy is fine underneath — the problem is presentation: informational things wear red too easily. Phase 8 rationalizes what renders red.

**4. The reply rate that doesn't math (51/4,359 showing ~0.1%).** Verified with live data — **the arithmetic everywhere in the app is correct** (every formula multiplies by 100; we checked all of them plus both Supabase views this week). What's wrong is the *definition*: the "Overall Reply Rate" card computes **all-time interested replies ÷ all-time emails sent** = 145 ÷ 150,602 = **0.096% → "0.1%"** — while sitting next to cards scoped to your selected time range. So when you mentally divide the visible 51 replies by the visible 4,359 sends and expect ~1.17%, the card is answering a completely different question. **Fix (Phase 1): the card becomes *total replies ÷ sends for the selected range* × 100, labeled with the range.** The digest's version gets aligned the same way.

**5. The mailbox-table numbers "1.4% · 6 · 30".** They're real columns: **1.4% = spam rate**, **6 = number of campaigns the box is attached to**, **30 = daily send limit**. The headers exist but clearly don't read at a glance — Phase 1 makes the labels unmissable (clear headers + hover explanations).

**6. Domain health showing 100/100/100 for 30 days.** It's a genuine daily series, not a stuck value — but the metric is Smartlead **warmup reputation**, which pins at 100 for every healthy mailbox (the burn threshold is 97), and the chart then *averages all domains together*. A healthy pool therefore draws a flat 100 line forever. The data isn't wrong; the chart is uninformative by construction. Phase 7 replaces it with something that says something (worst-domain band / at-risk count, flat-100 "all healthy" state).

**7. "Add Capacity" vs "Request order".** They are different, and one is dead. "Add Capacity" is the **legacy self-serve order flow — its API route is disabled** (returns 410) and has been since the sp_* migration. "Request order" is the **live, safe path**: it raises a pending `order_mailboxes` decision in the email-infra plugin's `sp_decisions` table, which then goes through approval and the supervised order engine — it can never spend by itself. **Verdict: delete Add Capacity, keep Request order** as the one way to order from the UI.

**8. What Acknowledge and Resolve actually do today.** Both write `status = resolved` to the database — Acknowledge is just Resolve with a canned note, and the alert **vanishes from the list**. That's exactly what Omar said shouldn't happen. Phase 8 introduces a real "acknowledged" state: greyed out, still visible, clearly separated from open items.

**9. The broken Smartlead conversation links (Tyler Lopez).** Links are built as `app.smartlead.ai/app/master-inbox?leadMap={smartlead_lead_id}`. Either the stored lead id is wrong/stale for some rows or the URL format doesn't deep-link the way we assumed. Phase 2 tests a sample of links per client and pins down which; Phase 3 fixes the template or the id capture, and hides the link when there's no valid id (instead of linking to nothing).

**10. "Interested replies actually consist of interested AND human action required."** Confirmed in the data: `sp_replies` currently holds **74 "Interested"** and **8 "human_action_required"** as separate categories. Today the Interested Leads tab counts *only* the literal `Interested` category, and the KPI cards use the perf plugin's `positive_replies` roll-up — two definitions that can disagree. **Decision needed from Omar** (below), then Phase 3 implements one definition everywhere and labels it on the cards so the meaning is visible.

**11. Ready Bank — how it works today.** A daily 09:12 UTC snapshot reads each client's `v_{slug}_tam` view and stores: total reachable, stamped-qualified, email-verified, LinkedIn-only, in-campaign, available. The caveats we already know: "in campaign" uses `smartlead_uploaded` rather than the canonical actually-emailed view; Cylindo has ~28k reachable leads with **no qualification decision recorded at all**; and Omnivate's lead table has no qualification column (its "qualified" is hardcoded 0 and shows n/a). This is precisely the per-client verification Omar asked for — Phase 6 does it properly, client by client.

**12. Command Center vs Digest.** They overlap heavily: both show the same four headline KPIs (computed via *different* query paths — a real consistency risk), top alerts, and deliverability issues. Digest-only value: the per-client breakdown table, the copy-to-clipboard text summary, and clean "all clear" states. Command-Center-only value: client cards with runway, the infrastructure strip, time-range filter. **Recommendation: one home.** Merge the digest's per-client table + copy-summary button + all-clear states into the Command Center, unify the KPI query path, and retire the Digest page. Phase 9.

**13. "Clicking Orders opens a new tab."** We audited every link — no sidebar or internal navigation uses new-tab behavior; only true external links do (View in Smartlead, LinkedIn, brief PDFs, billing). This may have been the desktop browser's behavior (middle-click/cmd-click) or a one-off. Phase 1 re-verifies on production; external links keep opening new tabs deliberately (that's correct behavior), internal ones never should.

**14. Why tabs feel dead for seconds.** Found the root cause, and it's structural: the client page renders **all eight tabs' data server-side on every request** — clicking a tab triggers a full re-render that re-runs every tab's queries (the Mailboxes tab alone fires 11), with **no per-tab loading states**, on a route that's forced fully dynamic. So the UI freezes while the server re-answers questions nobody asked. Phase 4 fixes the architecture: each tab loads only its own data, on demand, behind an instant skeleton.

**15. The Pipeline tab.** Omar's note referenced "the logic we want to implement" from a prior discussion that isn't captured anywhere in our docs. Flagged as a decision item below — we need him to spell out what he expects this tab to show before we build anything.

---

## Decisions we need from Omar (blocking specific items only)

Everything else in this plan proceeds without waiting. These five need his word:

1. **Interested definition** — should every "interested" number include `human_action_required` alongside `Interested`? **Our recommendation: yes**, labeled "Positive replies" with the definition shown on the card. (Affects KPIs, digest, Interested Leads tab.)
2. **Health score** — confirm removal (our recommendation), or ask us to rebuild it later with complete inputs.
3. **Retire Domain wiring** — the safe design is: the button raises a *retire-domain decision* that Omar (or Amzat) approves, and the plugin's daily routine executes the actual retirement — same one-actor model as ordering. The alternative (cockpit writes lifecycle state directly) crosses the boundary we deliberately dark-flagged in Build 5. **Recommendation: the decisions route.** Needs his sign-off either way.
4. **Digest page** — merge into Command Center and retire `/digest` (our recommendation), or keep it as a separate printable daily report?
5. **Pipeline tab** — what should it show? One paragraph from Omar unblocks it.

---

# The Phases

## Phase 1 — Declutter, branding, dead-button removal · 1 session

**Goal:** every removal Omar asked for, the sidebar rebrand, and the one fully-diagnosed data fix (the reply-rate card) — so the very next thing he opens already looks different.

**Branding**
- Sidebar: replace the generic mail glyph with the real Omnivate mark (the same brain-circuit image the favicon uses — `app/icon.png`; today the sidebar doesn't use it at all). Text becomes just **"Omnivate"** in a clean, confident type treatment. Page `<title>` follows.

**Command Center**
- Remove the green "Today, live" strip.
- Remove the **Actionable Alerts** and **Sending Capacity** KPI cards (alerts already have their own page + sidebar badge).
- Fix the **Overall Reply Rate** card → *total replies ÷ sends for the selected range*, labeled with the range (answer #4 above).
- Remove the health-score ring from client cards (answer #1); the alert-count bell stays.
- Remove the "Data Freshness" panel at the bottom; in its place, one quiet line up top: **"Data as of {business day} · synced {time}"** (the components for this already exist), with the amber "sync overdue" pill kept.

**Client pages**
- Remove the green today-live strip and the red "send volume drop" callout box from Overview.
- Remove the mailbox summary card section from Overview (the Mailboxes tab owns that story).
- Remove the "Pipeline Runway" element from the Runway & Capacity card — keep campaign runway and capacity-used; keep the "view all" link Omar likes.
- Campaign cards: remove the mini sparkline charts and the small health-score pill; **keep** Mark Done; remove the permanently-disabled Pause/Resume buttons (they return in a later build on the sp_* model — until then they're dead weight).
- Campaign detail panel: remove the Attached Mailboxes and Smartlead-data sections (Mailboxes tab owns them).
- Campaigns tab: remove the deliverability-issues banner.
- Mailboxes tab: **delete the legacy "Add Capacity" section** entirely (dead 410 flow — answer #7). "Request order" stays as the one ordering path.
- Mailbox table: make the column meanings unmissable — clear headers + hover text for Spam rate / Campaigns / Daily limit (answer #5).

**Navigation**
- Re-verify on production that internal nav never opens new tabs; external links (Smartlead, LinkedIn, PDFs) keep doing so deliberately.

**Done when:** build + e2e green (tests updated for removed elements), deployed, and a fresh screenshot set confirms every removal landed. Log which e2e assertions had to change.

**Log:** _(fill at session end)_

---

## Phase 2 — The numbers audit · 1 session · read-only, no code changes

**Goal:** Omar's core ask — "verify the data is actually correct, and if it isn't, figure out where the error comes from so it never happens again." We check the app against Supabase *and* Supabase against live Smartlead, for 7 / 14 / 30-day windows, on at least two clients (Acceleration Partners + Cylindo as the workhorses).

One important framing: the app **only** reads Supabase (no live Smartlead calls, by design). So any wrong number has exactly two possible sources — a wrong query/definition in the cockpit, or a gap in what the smartlead-perf plugin synced into Supabase. The audit assigns every discrepancy to one of those two buckets; bucket two is where "scrutinize the sync so it doesn't happen again" happens.

**The checklist** (each item gets a verdict: ✅ correct · 🟡 right data, wrong/unclear label · 🔴 wrong — with root cause):
- Command Center KPIs (sent yesterday / interested / total replies / reply rate) vs independent SQL vs Smartlead, per range including the "today" question.
- Client header numbers (lifetime sent, reply rate, mailbox count).
- **Sends vs Target** — both sides: sends from daily facts, and the target (there are *two* target concepts in the system: the app-config daily target driving charts, and the plugin's `min_daily_send_volume` driving the send-floor alert — confirm they're set consistently per client or consciously different).
- **Lead runway** number + color proportioning (thresholds are 7/3 days; math was verified exact on 07-08 — re-verify quickly and check the gauge scaling).
- 7-day sends chart daily values vs Smartlead per-day sends.
- Campaign cards: reply rate, and the **daily-sends series in the detail panel** (Omar saw "issue with getting daily sent" — likely sparse daily facts for some campaigns; find which and why).
- Provider Performance (14d): sender-side split, and the recipient-side gaps we already suspect (recipient send-split only fills where live send-event capture exists — historically Cylindo only; verify current coverage per client and whether the panel's hide-when-empty logic is honest).
- Inbox placement: verify test values vs Smartlead placement tests; explain the flat 99.9% line (plausibly real) and the missing line for AP Referral Standalone (single test = single point = no line — confirm, feed the UX fix to Phase 5).
- Mailboxes: spam rate / reply rate / daily limit spot-checks; domain health values; lifecycle history counts (and check the average-warmup aggregation — the parent-level averaging looks mathematically naive, verify before Phase 7 rebuilds the chart).
- Orders page: spent all-time (charged-only semantics), mailboxes/domains purchased, awaiting-approval projections, spend per client — vs InboxKit order records in `sp_orders`.
- Audit log sample vs `vw_cockpit_actions` source rows.
- Compare page series for 2–3 clients.
- Digest numbers vs Command Center numbers (they use different query paths — quantify any disagreement; feeds Phase 9's unification).
- Interested counts under both current definitions (perf-plugin roll-up vs `sp_replies` category) per client, plus where `human_action_required` shows up — so Omar's definition decision is made on real numbers.
- **Link audit:** sample 10+ interested-lead conversation links per client (find the Tyler Lopez failure mode), all campaign "View in Smartlead" links, audit-table domain links.

**Deliverable:** `docs/V2-AUDIT-FINDINGS.md` — verdict matrix + root cause per 🔴 + the exact backfill/fix list that Phase 3 executes. No fixes in this phase; it stays read-only so the findings are trustworthy.

**Log:** _(fill at session end)_

---

## Phase 3 — Fix the math, definitions, links + backfill · 1–2 sessions

**Goal:** everything 🔴 or 🟡 from Phase 2 gets fixed at the source, then re-verified green.

Known workload going in (Phase 2 will add/adjust):
- Implement the **interested definition** Omar picks (recommendation: Interested + human_action_required = "Positive replies") consistently across KPIs, digest, client pages, and the Interested Leads tab — with the definition labeled in the UI so nobody has to guess again.
- Fix the **conversation links** (correct template or id capture; no link rendered when no valid id).
- Any sync-side gaps found → fix in the smartlead-perf plugin's sync logic (that's its own repo/PR — coordinate, don't fork logic into the cockpit), then **backfill** affected date ranges via the plugin's resync path and re-verify the affected charts.
- Sends-vs-target: align or consciously document the two target sources per client.
- Re-run the Phase 2 checklist on everything touched → all green. Update `V2-AUDIT-FINDINGS.md` verdicts in place.

**Done when:** the findings doc shows no open 🔴, and a spot Smartlead cross-check on AP + Cylindo matches for 7/14/30d.

**Log:** _(fill at session end)_

---

## Phase 4 — Make it feel alive · 1 session

**Goal:** no click ever feels ignored. This is the "the screen feels stagnant" complaint, and it has one structural root cause (answer #14): the client page renders all eight tabs' queries on every request.

- **Per-tab loading:** each tab fetches only its own data when activated, behind an instant skeleton — tab clicks respond in milliseconds, data streams in. (Architecturally: per-tab lazy segments/Suspense instead of the current render-everything-as-props model. The heavy Mailboxes tab stops taxing every other click.)
- **Range toggles** (7D/14D/30D on Command Center, week/month/all on client pages): instant pressed-state + skeleton while data swaps (React transition), never a frozen screen.
- **Custom date range:** add a from–to date picker on the client page next to the presets, driving the same charts/KPIs, with the same loading behavior.
- Sidebar navigation: verify every route has a loading skeleton (most do; Command Center itself falls back to a generic one — give it a proper skeleton).
- Measure before/after: time-to-feedback on tab click and range switch, on production. Target: visible response < 100ms, always.

**Done when:** clicking any tab/range/date on production shows an immediate state change, and the client page no longer re-runs unrelated tabs' queries (verifiable in logs).

**Log:** _(fill at session end)_

---

## Phase 5 — Charts & campaigns restructure · 1 session

**Goal:** the chart story Omar described, and campaign sections that match how campaigns actually relate.

- **Client Overview keeps exactly two charts:**
  1. **Sends vs Target** — bars per day vs target line (exists; extend to respect the selected range/date picker).
  2. **Reply Rate trend** — NEW: one interactive chart with the rate line and a hovercard showing that day's sends, replies, and rate (replaces both the "Sends & Reply Rate 14d" and "Replies 30d" charts, which repeat each other). Hovercard math verified against the audit.
- **Campaigns tab sections:** Active shows **Primary campaigns only**; **Follow-up** and **Referral** get their own sections (the classification machinery already exists — `campaign_class` + overrides). Section counts reflect the split.
- **Compare campaigns:** overlaid day-by-day line charts for the two selected campaigns (sends, reply rate), plus placement side-by-side; data points verified in the audit.
- **Placement tab:** single-test campaigns render as a visible dot with a "1 test" note instead of an invisible non-line; test rows keep the date as the differentiator (verified in Phase 2 that dates do differentiate them).

**Done when:** overview shows exactly two charts, campaign sections split correctly for every client, compare renders overlaid series, deployed + screenshots.

**Log:** _(fill at session end)_

---

## Phase 6 — Ready Bank truth, client by client · 1 session

**Goal:** Omar doesn't trust a single method over four differently-shaped lead tables — he's right. We verify each client's numbers against what "qualified" and "in campaign" *actually mean* for that client, then make the card honest per client.

Per active client (AP, Cylindo, PayCaptain, Omnivate):
- Reconcile the TAM view's reachability gate against the mother-repo's schema rules (qualification truth is layered; send-eligibility is a derived view, never a hand-stamped column).
- Verify "qualified" = `qualification_decision='qualified'` coverage — and where the column doesn't exist or is unpopulated (Omnivate: no column; Cylindo: ~28k reachable-but-undecided), the card says **"not tracked"** instead of implying zero or overcounting.
- Switch **"in campaign"** to the canonical actually-emailed view (today it uses `smartlead_uploaded`, which disagrees with actually-emailed by ~1.8k on Cylindo).
- Add a small ⓘ on the card explaining, per client, what each line means and where it comes from — the honesty Omar asked for, visible in the UI.
- Produce the **schema-gap list for Omar** (the 28k Cylindo no-decision leads etc.) — that revalidation is his, not the cockpit's; we surface it cleanly.

**Done when:** each client's Ready Bank lines reconcile to a documented per-client definition, the snapshot function reflects the corrected definitions, and the gap list is in Omar's hands.

**Log:** _(fill at session end)_

---

## Phase 7 — Mailboxes & orders: make actions real · 1–2 sessions

**Goal:** every button on the Mailboxes tab either works safely or doesn't exist. Plus the two charts that currently say nothing.

- **Retire Domain** — currently wired to a disabled route, so it *errors when clicked*. Rebuild on the decisions model (pending Omar's #3): the button raises a retire-domain proposal → approval in-app (same panel as orders) → the plugin's daily routine executes the actual retirement (stop sending, cancel InboxKit billing, catch-all to master, tag retired, deploy reserves). The UI then reports real progress from the decision status, not a fake spinner.
- **Ordering path hardening:** verify Request order → `sp_decisions` → approve → supervised order engine works end to end from the UI (it's built; prove it on a real cycle and document the operator flow). This is the "rely on it to order mailboxes" confidence Omar asked for — leveraging the email-infra plugin's existing approval-gated engine rather than inventing anything new.
- **Domain Health chart** → replace the flat-average-of-100s with something informative: worst-domain / at-risk band over time, and an explicit "all domains healthy (100)" state when that's the truth (answer #6).
- **Lifecycle & Health History** → verify the aggregation (the pool average-warmup uses a naive mean when rolling up parent clients — fix the weighting), and split into two readable charts: lifecycle mix (active/resting/warming/at-risk counts) and average warmup, rather than one dual-axis mashup.
- **Domain drill-down:** clicking Active / Resting / Reserve shows the domain list for that state with per-domain boxes, health, tags, and age — the detail view Omar asked for.
- Orders page data issues found in Phase 2 get fixed here if they're mailbox/order-domain specific.

**Done when:** no button on the tab can hit a 410; retire-domain completes a real (or staged) cycle visible in the decisions panel; both charts render meaningfully for a healthy pool and an unhealthy one.

**Log:** _(fill at session end)_

---

## Phase 8 — Alerts that behave like alerts · 1 session

**Goal:** the alert list becomes something you *process*, not something that vanishes or shouts.

- **Acknowledge** becomes a real state: greyed out, stays visible, timestamped, excluded from "needs attention" counts but never silently deleted (today it hard-resolves — answer #8). Small additive schema change on both alert tables, same pattern we used for resolution notes.
- **Resolve** keeps its note, and gains **context routing**: resolving (or clicking) a bounce/burn alert takes you to that client's Mailboxes action-required section; a runway alert → Ready Bank/campaigns; a send-floor alert → client overview; a placement alert → placement tab. One mapping per alert type — dynamic, like Omar described.
- **Severity presentation:** red is reserved for genuinely critical actionable items; warnings are amber; informational/maintenance items go quiet neutral (no more red labels on FYIs — answer #3). A small legend explains the vocabulary in-UI.
- **Alerts page de-verbosing:** "Needs action" list first, everything else collapsed below; keep the summary cards Omar likes (critical / warning / resolved this week).

**Done when:** acknowledging keeps the row visible-but-grey on production, every alert type routes somewhere sensible, and nothing informational renders red.

**Log:** _(fill at session end)_

---

## Phase 9 — One home: merge Digest into Command Center + final QA + Loom · 1 session

**Goal:** end the "why do we have both?" question (pending Omar's #4), then close V2 like V1 closed — verified, demoed.

- **Merge:** Command Center absorbs the digest's per-client breakdown table, the copy-to-clipboard daily summary (same text format — it's genuinely useful for Slack), and the explicit "all clear" empty states. The KPI numbers come from **one** query path (today the two pages compute the same four KPIs two different ways). `/digest` redirects home.
- **Final links sweep:** every external link (conversation, campaign, LinkedIn, PDFs) sampled and working post-Phase-3 fixes.
- **Full regression:** e2e suite updated for the V2 surface and green against production; dark mode + mobile spot-check on the changed pages.
- **Loom:** update the walkthrough script (`docs/LOOM-WALKTHROUGH-SCRIPT.md`) to the V2 story — "here's what you asked for, here's where it lives now, here's the proof the numbers reconcile" — Amzat records, sends to Omar with this doc.

**Done when:** one home page, digest retired (or consciously kept per Omar), e2e green, Loom sent. V2 closed.

**Log:** _(fill at session end)_

---

## Explicitly NOT changing (Omar liked these)

Keeping ourselves honest about scope: the email-infrastructure strip on Command Center · the Command Center campaigns + Ready Bank cards' placement · rotation groups A/B/pool/reserve capacity card · infrastructure decisions panel · lifecycle color-coding + master inbox health · blacklist status card · client orders card + link to Orders · action-required section on Mailboxes · the Interested Leads tab (verify links only — and it's a candidate for the future client-facing portal) · client comparison page (verify data only) · alerts summary cards · settings pages · audit log (verify data only).

---

## Appendix A — Technical grounding (for the executing sessions)

Everything below was verified by code exploration + live DB checks on 2026-07-11/12. Trust but re-verify lines that matter before editing.

| Area | Where | Notes |
|---|---|---|
| Sidebar brand | `components/layout/sidebar.tsx:108-113` | Lucide `Mail` glyph + "Omnivate Cockpit" text; real mark only in `app/icon.png` |
| Health ring | `components/shared/health-ring.tsx`, score `lib/scoring/client-health.ts:71-99`, card `components/dashboard/client-summary-card.tsx:113-119`, header `components/clients/client-header.tsx:129-135` | Remove ring; keep bell (`client-summary-card.tsx:226-231` = open actionable alerts) |
| Sends-vs-target bar | `client-summary-card.tsx:136-141`, `components/shared/progress-bar.tsx:11-16` | red <50% of target |
| KPI cards | `app/(dashboard)/page.tsx:106-147`, `lib/queries/analytics.ts:336-407` | Reply-rate card: `analytics.ts:391-392` uses `all_time_interested/all_time_emails_sent` (verified live: 145/150,602 = 0.0963% → "0.1%") — change to period replies/sent |
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
| Retire domain (broken) | `mailbox-inventory-table.tsx:303-325,440-448,519-524` → `app/api/domains/drain/route.ts:6-13` = **410** | Rebuild via decisions model (Omar #3) |
| Domain health chart | `components/mailboxes/mailbox-health-chart.tsx`, `lib/queries/mailboxes.ts:251-283` (`vw_cockpit_domain_health_daily.warmup_health_pct`, avg across domains) | Flat 100 = healthy pool averaged; redesign |
| Lifecycle history | `components/mailboxes/lifecycle-history-card.tsx`, `lib/queries/portfolio.ts:104-154` | Naive pairwise mean on parent rollup `portfolio.ts:125-142` — fix weighting |
| Interested leads tab | `components/clients/tabs/interested-leads-tab.tsx` (Smartlead link :18-20 `master-inbox?leadMap={smartlead_lead_id}`); table `cockpit_interested_leads`; refresh `fn_cockpit_snapshot_interested_leads()` cron 09:14 UTC (mig 015) | Definition = `sp_replies` `lead_category_name='Interested'` ONLY (mig 013/014) |
| Interested categories (live) | `sp_replies`: Interested 74 · human_action_required 8 · OOO 1,238 · null 186 · DNC 115 · Not Interested 89 (2026-07-12) | Omar decision #1 |
| Ready Bank | `cockpit_ready_bank_daily` (mig 010/016), `fn_cockpit_snapshot_ready_bank()` cron 09:12 UTC; reads `v_{slug}_tam` per client; card `components/clients/ready-bank-card.tsx` | omnivate qualified hardcoded 0 (016.sql:98-104); in_campaign = `smartlead_uploaded` → switch to actually-emailed |
| Sends/target sources | targets: `client_analytics_config.daily_email_target`(+weekday json) vs `sp_clients.min_daily_send_volume` (send-floor, mig 012) | Two concepts — reconcile per client |
| Runway | `vw_cockpit_client_runway` (mig 007:60-114), thresholds `client_analytics_config` 7/3, colors `design-tokens.ts:71-79` | Math verified exact 07-08 |
| Provider perf | sender `vw_cockpit_provider_daily` (`analytics.ts:1007-1050`), recipient `vw_cockpit_recipient_daily` (`portfolio.ts:41-77`) | Recipient send-split only where send-event capture exists (historically Cylindo) |
| Placement | `vw_cockpit_placement_results`, `campaigns.ts:401-415`, chart `placement-trend-chart.tsx` | 1 test = 1 point = no line; ≥2 points needed |
| Orders | `vw_cockpit_orders`, `lib/queries/orders.ts:42-56`, page `app/(dashboard)/orders/page.tsx:45-76` | spent = completed only; awaiting = projected |
| Audit log | `vw_cockpit_actions` via `lib/queries.ts:486-537` | |
| Compare | `lib/queries/analytics.ts:840-916` | replyRate ×100 correct |
| Tab slowness | `app/(dashboard)/layout.tsx:9` force-dynamic; `clients/[slug]/page.tsx:93-135` renders ALL tabs as awaited props; `client-tabs.tsx:47-58` router.replace re-runs everything; no per-tab Suspense; Mailboxes tab = 11 queries (`mailboxes-tab.tsx:36-48`) | Phase 4 architecture fix |
| Digest | `app/(dashboard)/digest/page.tsx` (`getDigestData` `analytics.ts:1074-1216` ≠ `getGlobalKPIs` path); copy text built `digest/page.tsx:30-74` | Phase 9 merge |
| Feature flags | `lib/flags.ts` — ON: pipelineActions, infraDecisions, infraDecisionApprove, infraOrderRequest; OFF: onboarding, infraActions, campaignActions, infraSwapEscalate | |
| DB access workaround | MCP supabase token flaps → Management API `POST /v1/projects/uivgowblojtyiobhgjlv/database/query`, token = `SUPABASE_ACCESS_TOKEN` in `C:/Users/HP/email-infra-plugin/plugins/email-infra-plugin/.env.local`, `--data-binary @file` | Verified working 2026-07-12 |

**Related repos:** smartlead-perf-plugin (sync logic — Phase 3 fixes land there via PR), email-infra plugin (decisions/order engine — Phase 7 integrates, never bypasses). The mother repo `omnivate-ai-outbound` is read-only reference for schema rules (Ready Bank, Phase 6); no direct changes there — anything needed goes via branch + PR for Omar.

## Appendix B — What was already verified before this plan (don't re-litigate)

From `docs/DATA-ACCURACY-VALIDATION.md` (2026-07-08, independent recompute): Ready Bank arithmetic vs its own definition (exact), runway math (exact, 3 clients), rotation capacity (exact), send-floor logic (correct), 7-day KPIs (consistent), Smartlead lifetime lag = intended once-daily sync behavior. Plus this session (2026-07-11/12, live DB): both rate views are ×100-correct; the 0.1% card mystery solved (all-time scope); reply categories enumerated. The audit in Phase 2 focuses on what's NOT yet cross-checked against Smartlead — per-day series, per-campaign dailies, placement values, orders, and every number Omar specifically named.
