# Phase 9 — One Home: Digest merged into the Command Center + V2 close-out

**For:** Omar / Amzat · **Date:** 2026-07-15
**Goal (plan):** end the "why do we have both?" question — the Command Center absorbs the digest; `/digest` redirects home; headline KPIs come from one code path; final links sweep + regression; Loom. **Done when: one home page, digest retired, tests green, Loom sent. V2 closed.**

## What shipped

### The merge (one home, one code path)
- The Command Center now carries a **Daily Summary** section: the per-client breakdown table + the copy-to-clipboard Slack summary + an explicit **all-clear** state — everything the `/digest` page did.
- **One code path.** The old page called a separate `getDigestData()`; the merged section reads the *same* `getGlobalKPIs` + `getClientSummaries` the KPI cards and client grid already use. `getDigestData` (and its `DigestData`/`DigestClientRow` types) were deleted — there is no second path left to drift. Per-client positives were added to `ClientSummary` (`periodPositives`, range-summed) so the breakdown sums exactly to the headline "Positive Replies" KPI.
- The summary is **range-scoped** to match the KPIs above it (label follows the range selector). Select "Today" and copy for the daily Slack post; the text format is the same shape as before.
- **`/digest` redirects to `/`** (bookmarks/links keep working). Removed from the sidebar and repointed the command-palette "Daily Summary" entry (keywords digest/summary) to home.

### Final links sweep (post-Phase-3 fixes, re-confirmed live)
- **Conversation links: 8/8 sampled resolve to the correct lead** against live Smartlead — the Tyler Lopez failure mode (RC-9) stays fixed. Coverage: 148/149 interested leads carry a `campaign_lead_map_id` (the 1 without renders no link, by design).
- **Campaign View-in-Smartlead: 21/21** active campaigns carry a `smartlead_campaign_id`.
- LinkedIn 140/149 · call-brief PDFs 40/149 (only clients that generate them) — links present where the data is.

### Regression + deploy
- e2e updated for the V2 surface: the digest spec now asserts the redirect + the merged Daily Summary; the smoke nav list drops `/digest`. Full suite green local + prod.
- Dark-mode + mobile spot-checks on the merged Command Center.

## The one human-owned item: the Loom
The plan's final deliverable is a **fresh Loom walkthrough** ("here's what you asked for, here's where it lives, here's the proof the numbers reconcile"). That's a recording only a person can make — it can't be produced from here. Everything it would demo is live and verified; a suggested 6-beat script is below.

**Suggested Loom beats:**
1. Command Center — range selector drives KPIs + cards + the new Daily Summary (one home; digest gone from the nav, `/digest` still redirects here).
2. Copy the daily summary → paste into Slack.
3. A client → Overview: the three-chart suite (Phase 5), Ready Bank truth (Phase 6).
4. Mailboxes: worst/at-risk Domain Health, the two split lifecycle charts, click a lifecycle state → domain drill-down; Retire Domain raises a decision (Phase 7).
5. Alerts: acknowledge keeps a row visible-but-grey, red only for actionable, per-alert "View" routing (Phase 8).
6. The reconciliation proof — `docs/V2-AUDIT-FINDINGS.md` (all reds closed, numbers match Smartlead).

## V2 status: CLOSED (pending the Loom)
All nine phases shipped and prod-verified. Phase docs: `V2-AUDIT-FINDINGS.md` (2–3), `V2-PHASE5-CHART-CHANGES.md`, `V2-PHASE6-READY-BANK-GAPS.md`, `V2-PHASE7-MAILBOX-ACTIONS.md`, `V2-PHASE8-ALERTS.md`, this doc (9). Open decisions for Omar are collected in `V2-PHASE3-OMAR-QUESTIONS.md` + each phase doc's decisions table.
