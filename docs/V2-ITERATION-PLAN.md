# Omnivate Cockpit — V2 Iteration Plan

**Prepared by:** Amzat · **For:** Omar's review and sign-off · **Date:** 2026-07-12
**Scope:** the second iteration of the cockpit, built directly from your full-app walkthrough (2026-07-11)
**Live app:** https://omnivate-cockpit.vercel.app · **Repo:** `Omnivate-AI/omnivate-cockpit`

This is the requirements document for V2. It answers every question you raised in the walkthrough, lists the decisions we've taken (each one you can veto), and lays out the work in nine phases with clear acceptance criteria. The tracker below reflects live status as phases ship.

> **✅ Approved by Omar — 2026-07-13** (ClickUp): *"These look good. I am happy for you to proceed with these requirements."* One addition from the same comment: **overhaul the client-level graphs** — e.g. a chart focused on the *number of interested replies* only, another tracking *reply rate and its change*; beyond those, use judgment (remove some, update some, add new ones) and review together after. Folded into Phase 5. No decision vetoed. Pipeline-tab question still open.

---

## Your review in one paragraph

You went through every page, and the feedback boils down to four themes. **(1) Trust the numbers** — verify everything visible against Smartlead, find where any mismatch enters the pipeline, and backfill where the database is wrong. **(2) Cut the clutter** — remove the banners, badges, duplicate cards and half-meaningful scores; keep only what someone acts on. **(3) Make it feel alive** — every click should respond instantly with a loading state; today the app can feel frozen for seconds after clicking a tab or a range. **(4) Finish the actions story** — buttons like Retire Domain must actually work (safely, through the email-infra plugin's approval model), and alerts should behave like a real notification system: acknowledging greys out, resolving routes you to the fix.

Everything you asked us to verify gets verified fresh as part of this plan — the data-accuracy validation is Phase 2's entire job, and nothing here leans on past checks.

---

## The plan at a glance

| Phase | What | Effort | Status |
|---|---|---|---|
| 1 | Declutter, branding, dead-button removal | 1 session | ✅ Done (2026-07-13) |
| 2 | The numbers audit — every metric vs Smartlead | 1 session | ✅ Done (2026-07-14) — `docs/V2-AUDIT-FINDINGS.md` |
| 3 | Fix the math, definitions, links + backfill | 1–2 sessions | ✅ Done (2026-07-14) — all 🔴 closed + re-verified vs Smartlead; 2 decisions with Omar (`docs/V2-PHASE3-OMAR-QUESTIONS.md`) |
| 4 | Make it feel alive (loading states, date range) | 1 session | ✅ Done (2026-07-14) — feedback 2.7–4.4s → instant; tab switches run only their own queries |
| 5 | Charts & campaigns restructure + client-graph overhaul (Omar 07-13) | 1 session | ✅ Done (2026-07-14) — confirmed 3-chart suite live; change list in `docs/V2-PHASE5-CHART-CHANGES.md` for Omar's review |
| 6 | Ready Bank truth, client by client | 1 session | ✅ Done (2026-07-14) — per-client reconciliation + migration 018 (emailed = live truth, qualified = not-tracked semantics); gap list in `docs/V2-PHASE6-READY-BANK-GAPS.md` |
| 7 | Mailboxes & orders — make actions real | 1–2 sessions | ✅ Done (2026-07-14) — retire on the decisions model + supervised retire-engine (staged-proven), order path un-stranded, worst/at-risk + weighted split charts, domain drill-down; `docs/V2-PHASE7-MAILBOX-ACTIONS.md` + email-infra PR #2 |
| 8 | Alerts that behave like alerts | 1 session | ☐ Not started |
| 9 | One home: merge Digest into Command Center + final QA + Loom | 1 session | ☐ Not started |

**Schedule at sprint pace:** Day 1 → Phase 1 + start Phase 2 · Day 2 → finish 2 + Phase 3 · Day 3 → Phases 4 + 5 · Day 4 → Phases 6 + 8 · Day 5 → Phase 7 · Day 6 → Phase 9 + the Loom. Roughly six working days.

---

## Straight answers to the questions you asked

We traced every "what does this mean?" from the walkthrough to its source before writing this plan, so the answers are grounded, not guessed:

**1. The number beside the client name (the "32" on Acceleration Partners).** It's a composite **health score** (0–100), not an alert count. Five ingredients weighted 20% each: mailbox health, send adherence, reply rate, inbox placement, alert penalty. The ring turns red below 50. The problem: on the client cards, two of the five ingredients aren't actually wired and silently default to a neutral 50 — so the score is half-blind. **It's being removed** (confirmed).

**2. The red bar on the client card.** That's the **Sends vs Target** progress bar — red when yesterday's sends were under 50% of the client's daily target, amber under 100%, green at or over target. This one is meaningful and stays; Phase 2 verifies both numbers behind it.

**3. The "critical / warning / LD" labels.** The actual vocabulary in the system: severity `critical`/`high` (renders red), `warning`/`medium` (amber), `info`/`low` (blue) — there is no "LD" anywhere; on screen it was almost certainly "**Low**". There's also a second axis, **tier**: `actionable` (counts in every top-line number) vs `maintenance` (background noise, excluded from counts). The taxonomy underneath is sound — the presentation is the problem: informational items wear red too easily. Phase 8 fixes what gets to be red.

**4. The reply rate that doesn't math (51/4,359 showing ~0.1%).** We traced every reply-rate formula in the app and in the database views — **the arithmetic is correct everywhere**. What's wrong is the *definition*: that card computes **all-time interested replies ÷ all-time emails sent** (currently 145 ÷ 150,602 = 0.096%, which renders as "0.1%") — while sitting next to cards scoped to your selected time range. So when you mentally divide the visible 51 replies by the visible 4,359 sends and expect ~1.17%, the card is answering a completely different question. **Fix (Phase 1): the card becomes *total replies ÷ sends for the selected range*, labeled with the range.** Phase 2's audit then re-proves the number against Smartlead like everything else.

**5. The mailbox-table numbers "1.4% · 6 · 30".** Real columns that don't read at a glance: **1.4% = spam rate**, **6 = campaigns the box is attached to**, **30 = daily send limit**. Phase 1 makes the labels unmissable.

**6. Domain health showing 100/100/100 for 30 days.** It's a genuine daily series, not a stuck value — but the metric is Smartlead **warmup reputation**, which sits at 100 for every healthy mailbox (the burn threshold is 97), and the chart averages all domains together. A healthy pool therefore draws a flat 100 line forever. The data isn't wrong; the chart is uninformative by construction. Phase 7 replaces it with something that says something.

**7. "Add Capacity" vs "Request order".** They're different, and one is dead. "Add Capacity" is the legacy self-serve order flow — its backend has been disabled since the data-model migration, so it can't do anything. "Request order" is the live, safe path: it raises a pending order decision in the email-infra plugin, which goes through approval and the supervised order engine — it can never spend by itself. **Verdict: delete Add Capacity, keep Request order** as the one way to order from the UI.

**8. What Acknowledge and Resolve actually do today.** Both mark the alert resolved in the database — Acknowledge is just Resolve with a canned note, and the alert **vanishes from the list**. That's exactly the behavior you flagged. Phase 8 introduces a real "acknowledged" state: greyed out, still visible, clearly separated from open items.

**9. The broken Smartlead conversation links (the Tyler Lopez case).** Links are built from a stored Smartlead lead id and open the master inbox filtered to that lead. Either the stored id is wrong or stale for some rows, or the URL format doesn't deep-link the way it should. Phase 2 tests a sample of links per client to pin down which; Phase 3 fixes it and hides the link entirely when there's no valid target (no more links to nowhere).

**10. "Interested replies actually consist of interested AND human action required."** Confirmed in the data — the replies table currently holds **74 "Interested"** and **8 "human_action_required"** as separate categories, and today's surfaces disagree on which to count. **Decision taken (per Amzat): every interested number includes both**, labeled "Positive replies" with the definition visible on the card. Phase 3 implements it everywhere.

**11. Ready Bank — where the numbers come from.** A daily snapshot reads each client's reachable-leads view and stores: total reachable, qualified, email-verified, LinkedIn-only, in-campaign, available. Your instinct is right that one method over four differently-shaped lead tables is risky — known caveats already include: "in campaign" uses the uploaded flag rather than the canonical actually-emailed view; Cylindo has ~28k reachable leads with no qualification decision recorded at all; Omnivate's table has no qualification column (its "qualified" shows n/a). Phase 6 verifies each client against what "qualified" actually means for that client and makes the card honest per client.

**12. Command Center vs Digest.** They overlap heavily: the same four headline KPIs (computed via two different code paths — a real consistency risk), top alerts, and deliverability issues. Digest-only value: the per-client breakdown table, the copy-to-clipboard daily summary, clean "all clear" states. **Decision taken: one home.** The Command Center absorbs the digest's per-client table, copy-summary button and all-clear states; the KPI numbers get one shared code path; the Digest page retires. Phase 9.

**13. "Clicking Orders opens a new tab."** We audited every link — no sidebar or internal navigation opens new tabs; only true external links do (View in Smartlead, LinkedIn, brief PDFs), which is deliberate. Phase 1 re-verifies this on production; internal navigation must never leave the tab.

**14. Why tabs feel dead for seconds.** Found the root cause, and it's structural: the client page loads **all eight tabs' data on every request** — clicking one tab re-runs every tab's queries (the Mailboxes tab alone fires eleven), with no per-tab loading states. The UI freezes while the server re-answers questions nobody asked. Phase 4 fixes the architecture: each tab loads only its own data, on demand, behind an instant skeleton.

**15. The Pipeline tab.** Your note referenced "the logic we want to implement" from a prior discussion that isn't captured in any of our docs. This is the one open question in this plan — see below.

---

## Decisions taken (flag anything you'd change)

These four are settled so the build isn't blocked — but this document is your chance to veto any of them:

1. **Interested definition** — every "interested" number includes `human_action_required` alongside `Interested`, labeled "Positive replies", definition shown in the UI. *(Confirmed 2026-07-12.)*
2. **Health score** — removed entirely (the number beside the client name). If we ever want a health score back, we rebuild it with complete inputs and an on-hover explanation. *(Confirmed 2026-07-12.)*
3. **Retire Domain wiring** — built on the decisions model: the button raises a *retire-domain proposal*, it's approved in-app, and the plugin's daily routine executes the actual retirement (stop sending, cancel billing, catch-all to master, tag retired, deploy reserves). The cockpit proposes and approves; the engines remain the only actors — same safety model as ordering. *(Going with the recommended safe route.)*
4. **Digest page** — merged into the Command Center as described in answer #12; `/digest` retires. One home, one set of numbers. *(Going with the recommended route.)*

## The one question we need from you

**What should the Pipeline tab show?** Your walkthrough referenced pipeline logic from a previous conversation that never made it into writing. One short paragraph from you — what you expect to see on that tab, per client — unblocks it. Until then, no phase touches the Pipeline tab.

---

# The Phases

## Phase 1 — Declutter, branding, dead-button removal

**Goal:** every removal you asked for, the sidebar rebrand, and the one fully-diagnosed fix (the reply-rate card) — so the next time you open the app it already looks different.

**Branding**
- Sidebar: the generic mail glyph is replaced with the real Omnivate mark (the same one the favicon uses — today the sidebar doesn't use it at all). The text becomes just **"Omnivate"** in a clean, confident type treatment.

**Command Center**
- Remove the green "Today, live" strip.
- Remove the **Actionable Alerts** and **Sending Capacity** KPI cards (alerts already have their own page and sidebar badge).
- Fix the **Overall Reply Rate** card → *total replies ÷ sends for the selected range*, labeled with the range (answer #4).
- Remove the health-score ring from client cards (answer #1); the alert-count bell stays.
- Remove the "Data Freshness" panel at the bottom; in its place, one quiet line up top: **"Data as of {business day} · synced {time}"**, keeping the amber "sync overdue" warning when the daily sync is late.

**Client pages**
- Remove the green today-live strip and the red "send volume drop" callout from Overview.
- Remove the mailbox summary card from Overview (the Mailboxes tab owns that story).
- Remove the "Pipeline Runway" element from the Runway & Capacity card — keep campaign runway and capacity-used, keep the "view all" link you liked.
- Campaign cards: remove the mini sparkline charts and the small health-score pill; **keep** Mark Done; remove the permanently-disabled Pause/Resume buttons (they return in a later build when re-wired properly — until then they're dead weight).
- Campaign detail panel: remove the Attached Mailboxes and Smartlead-data sections (the Mailboxes tab owns them).
- Campaigns tab: remove the deliverability-issues banner.
- Mailboxes tab: **delete the legacy "Add Capacity" section** entirely (answer #7). "Request order" stays as the one ordering path.
- Mailbox table: clear headers + hover explanations for Spam rate / Campaigns / Daily limit (answer #5).

**Navigation**
- Verify on production that internal navigation never opens new tabs; external links (Smartlead, LinkedIn, PDFs) keep doing so deliberately.

**Done when:** build and tests green (tests updated for the removed elements), deployed, and a fresh screenshot set confirms every removal landed.

---

## Phase 2 — The numbers audit · read-only, no code changes

**Goal:** your core ask — "verify the data is actually correct, and if it isn't, figure out where the error comes from so it never happens again." Every visible metric gets checked against Supabase *and* Supabase against live Smartlead, for 7 / 14 / 30-day windows, on at least two clients (Acceleration Partners + Cylindo as the workhorses).

One framing that makes this tractable: the app **only** reads our database — it never calls Smartlead live, by design. So any wrong number has exactly two possible sources: a wrong query or definition in the cockpit, or a gap in what the daily sync wrote into the database. The audit assigns every discrepancy to one of those two buckets; bucket two is where "scrutinize the sync so it doesn't happen again" happens.

**The checklist** — each item gets a verdict (✅ correct · 🟡 right data, unclear label · 🔴 wrong, with root cause):
- Command Center KPIs (sent yesterday / interested / total replies / reply rate) vs independent recomputation vs Smartlead, per time range — including the "is today really from the database" question.
- Client header numbers (lifetime sent, reply rate, mailbox count).
- **Sends vs Target** — both sides. Note: there are *two* target concepts in the system (the app-config daily target driving the charts, and the plugin's minimum-send-volume driving the send-floor alert) — confirm they're consistent per client or consciously different.
- **Lead runway** — the number, the math, and the color proportioning/gauge scaling.
- The 7-day sends chart, day by day, vs Smartlead's per-day sends.
- Campaign cards: reply rate, and the **daily-sends series in the detail panel** (you saw "issue with getting daily sent" — likely sparse daily data for some campaigns; find which and why).
- Provider Performance (14d): the sender-side split, and the recipient-side coverage (the recipient view depends on live send-event capture, which historically only some clients have — verify per client and make the panel honest about gaps).
- Inbox placement: verify test values vs Smartlead placement tests; explain the flat 99.9% line (plausibly real) and the missing line for AP Referral Standalone (a single test can't draw a line — confirm, and feed the fix to Phase 5).
- Mailboxes: spam rate / reply rate / daily limit spot-checks; domain health values; lifecycle history counts and the average-warmup aggregation method.
- Orders page: spent all-time (charged-only), mailboxes/domains purchased, awaiting-approval projections, spend per client — vs the actual order records.
- Audit log sample vs its source rows.
- Compare page series for 2–3 clients.
- Digest numbers vs Command Center numbers (they use different code paths today — quantify any disagreement before Phase 9 unifies them).
- Interested counts under both current definitions, per client, so the new "Positive replies" definition lands on verified numbers.
- **Link audit:** a sample of 10+ interested-lead conversation links per client (pin down the Tyler Lopez failure mode), every campaign "View in Smartlead" link, audit-table domain links.

**Deliverable:** `docs/V2-AUDIT-FINDINGS.md` — a verdict matrix, root cause for every 🔴, and the exact fix/backfill list that Phase 3 executes. No fixes happen in this phase; it stays read-only so the findings are trustworthy.

---

## Phase 3 — Fix the math, definitions, links + backfill

**Goal:** everything 🔴 or 🟡 from the audit gets fixed at the source, then re-verified green.

Known workload going in (the audit will add to it):
- Implement the confirmed **"Positive replies" definition** (Interested + human_action_required) consistently across KPIs, digest, client pages, and the Interested Leads tab — with the definition labeled in the UI so nobody has to guess again.
- Fix the **conversation links** (correct the link template or the id capture; render no link when there's no valid target).
- Any sync-side gaps → fixed in the sync pipeline itself (that's its own repo; changes go in as a proper PR), then **backfill** the affected date ranges and re-verify the charts that depended on them.
- Sends-vs-target: align the two target sources per client, or document why they intentionally differ.
- Re-run the audit checklist on everything touched → all green, verdicts updated in the findings doc.

**Done when:** the findings doc shows no open 🔴, and a spot Smartlead cross-check on AP + Cylindo matches for 7/14/30-day windows.

---

## Phase 4 — Make it feel alive

**Goal:** no click ever feels ignored. This is the "screen feels stagnant" complaint, and it has one structural root cause (answer #14) — so this is an architecture fix, not a sprinkle of spinners.

- **Per-tab loading:** each client tab fetches only its own data when opened, behind an instant skeleton — tab clicks respond immediately, data streams in. The heavy Mailboxes tab stops taxing every other click.
- **Range toggles** (7D/14D/30D, week/month/all): instant pressed-state and skeleton while data swaps — never a frozen screen.
- **Custom date range:** a from–to date picker on the client page next to the presets, driving the same charts and KPIs, with the same loading behavior.
- Every route gets a proper loading skeleton (most have one; the Command Center itself falls back to a generic one today).
- Measure before/after on production: time-to-visible-feedback on tab clicks and range switches. Target: under 100ms, always.

**Done when:** clicking any tab, range or date on production shows an immediate response, and switching tabs no longer re-runs unrelated queries.

---

## Phase 5 — Charts & campaigns restructure

**Goal:** the chart story you described, and campaign sections that match how campaigns actually relate.

**Expanded per your 07-13 comment:** the client-level graph suite gets a full pass — some charts removed, some updated, some added — our best go, then we review together. The confirmed set for the Client Overview:
  1. **Sends vs Target** — daily bars vs the target line (exists today; extended to respect the selected range and date picker).
  2. **Reply Rate trend + change** — new: the rate line with its change over the period made explicit, and a hovercard showing that day's sends, replies and rate. It replaces both the "Sends & Reply Rate 14d" and "Replies 30d" charts, which repeat each other. Hovercard math verified in the audit.
  3. **Interested replies** — new: a chart focused on the *number* of interested (positive) replies and only that, per the confirmed "Positive replies" definition.
  Any further additions/removals at the client level are judgment calls made in this phase and flagged for your review.
- **Campaigns tab sections:** Active shows **primary campaigns only**; **Follow-up** and **Referral** campaigns get their own sections (the classification machinery already exists). Section counts reflect the split.
- **Compare campaigns:** overlaid day-by-day line charts for the selected campaigns (sends, reply rate), plus placement side by side — the visual you described.
- **Placement tab:** single-test campaigns render as a visible dot with a "1 test" note instead of an invisible non-line; test rows keep the date as the differentiator.

**Done when:** the overview shows the confirmed chart set (sends vs target · reply rate + change · interested replies), campaign sections split correctly for every client, compare renders overlaid series, deployed with screenshots and a change-list of graph judgment calls for your review.

---

## Phase 6 — Ready Bank truth, client by client

**Goal:** you don't trust a single method over four differently-shaped lead tables — you're right not to. We verify each client's numbers against what "qualified" and "in campaign" *actually mean* for that client, then make the card honest per client.

Per active client (Acceleration Partners, Cylindo, PayCaptain, Omnivate):
- Reconcile the reachable-leads view against the canonical qualification rules for that client's table (qualification truth is layered; send-eligibility must come from derived views, never hand-stamped columns).
- Verify the "qualified" line — and where the underlying column doesn't exist or was never populated (Omnivate: no column; Cylindo: ~28k reachable leads with no decision recorded), the card says **"not tracked"** instead of implying zero or overcounting.
- Switch **"in campaign"** to the canonical actually-emailed view (today it uses the uploaded flag, which is known to drift from reality).
- Add a small ⓘ on the card explaining, per client, what each line means and where it comes from — honesty visible in the UI.
- Produce the **schema-gap list** (e.g. the 28k undecided Cylindo leads) — that data revalidation is an operations decision for you, not something the cockpit invents; we surface it cleanly.

**Done when:** each client's Ready Bank lines reconcile to a documented per-client definition, the daily snapshot uses the corrected definitions, and the gap list is in your hands.

---

## Phase 7 — Mailboxes & orders: make actions real

**Goal:** every button on the Mailboxes tab either works safely or doesn't exist — plus the two charts that currently say nothing.

- **Retire Domain** — currently wired to a disabled backend, so it errors when clicked. Rebuilt on the decisions model (decision #3): the button raises a retire-domain proposal → approval in-app → the plugin's daily routine executes the actual retirement (stop sending, cancel InboxKit billing, catch-all to master, tag retired, deploy reserves). The UI reports real progress from the decision status.
- **Ordering path proven end to end:** Request order → decision → approve → supervised order engine, exercised from the UI on a real cycle and documented — so "request order" is something you can rely on to actually get mailboxes ordered.
- **Domain Health chart** → replaced with something informative: worst-domain / at-risk band over time, plus an explicit "all domains healthy (100)" state when that's the truth (answer #6).
- **Lifecycle & Health History** → verify the aggregation (the pool-average warmup calculation looks mathematically naive — fix the weighting), and split the mashed dual-axis chart into two readable ones: lifecycle mix over time, and average warmup over time.
- **Domain drill-down:** clicking Active / Resting / Reserve shows the domain list for that state — per-domain boxes, health, tags, age. The detail view you asked for.
- Any orders-page data issues found in the audit get fixed here.

**Done when:** no button on the tab can hit a dead backend; retire-domain completes a real (or staged) cycle visible in the decisions panel; both charts render meaningfully for a healthy pool and an unhealthy one.

---

> ✅ **Done (2026-07-15)** — acknowledge is a real greyed/visible state excluded from counts (migration 019); resolve keeps its note + per-type context routing; severity is tier-aware (nothing informational renders red) with a legend; page leads with needs-action, rest collapsed. `docs/V2-PHASE8-ALERTS.md`.

## Phase 8 — Alerts that behave like alerts

**Goal:** the alert list becomes something you *process*, not something that vanishes or shouts.

- **Acknowledge** becomes a real state: greyed out, stays visible, timestamped, excluded from "needs attention" counts — never silently deleted (today it hard-resolves; answer #8).
- **Resolve** keeps its note, and gains **context routing**: a bounce/burn alert takes you to that client's Mailboxes action-required section; a runway alert → Ready Bank/campaigns; a send-floor alert → the client overview; a placement alert → the placement tab. One mapping per alert type — dynamic, exactly as you described.
- **Severity presentation:** red is reserved for genuinely critical, actionable items; warnings are amber; informational/maintenance items go quiet neutral. A small legend explains the vocabulary in the UI (answer #3).
- **Alerts page de-verbosing:** a "Needs action" list first, everything else collapsed below; the summary cards you liked (critical / warning / resolved this week) stay.

**Done when:** acknowledging keeps the row visible-but-grey on production, every alert type routes somewhere sensible, and nothing informational renders red.

---

## Phase 9 — One home: merge Digest into Command Center + final QA + Loom

**Goal:** end the "why do we have both?" question (decision #4), then close V2 the way V1 closed — verified and demoed.

- **Merge:** the Command Center absorbs the digest's per-client breakdown table, the copy-to-clipboard daily summary (same text format — it's genuinely useful for Slack), and the explicit "all clear" states. The headline KPIs come from **one** shared code path. `/digest` redirects home.
- **Final links sweep:** every external link (conversations, campaigns, LinkedIn, PDFs) sampled and working after the Phase 3 fixes.
- **Full regression:** test suite updated for the V2 surface and green against production; dark mode and mobile spot-checks on every changed page.
- **Loom:** a fresh walkthrough recorded for you — "here's what you asked for, here's where it lives now, here's the proof the numbers reconcile."

**Done when:** one home page, digest retired, tests green, Loom sent. V2 closed.

---

## What we're deliberately NOT changing (you liked these)

Keeping ourselves honest about scope: the email-infrastructure strip on the Command Center · the Command Center campaigns and Ready Bank cards' placement · the rotation groups A/B/pool/reserve capacity card · the infrastructure decisions panel · lifecycle color-coding and master-inbox health · the blacklist status card · the client orders card and its link to Orders · the action-required section on Mailboxes · the Interested Leads tab (links get verified, and it's a candidate for the future client-facing portal) · the client comparison page (data verified only) · the alerts summary cards · settings pages · the audit log (data verified only).
