# Omnivate Cockpit — V5 Iteration Plan

**Prepared by:** Amzat · **For:** Omar's review · **Date:** 2026-07-21
**Scope:** the fifth iteration, from your V4 Loom review — the AP ratio question, the Compare date picker, and the first LinkedIn build
**Live app:** https://omnivate-cockpit.vercel.app · **Repo:** `Omnivate-AI/omnivate-cockpit`

> **Sources:** your Loom walkthrough of V4. 3 work streams, 8 action points. Per your instruction, the LinkedIn work was data-discovery-first and built local-dev-first so the working email surfaces stayed untouched.

---

## Your review in one paragraph

The V4 additions land — the ratios read right at the top level and Compare is "super useful" — but **AP's numbers confused you for a good reason**: the client page said 758 contacts / 885 emails per positive while the campaign card showed 33, and your hypothesis was that follow-up campaigns were polluting the math. You want the **date-range picker on Compare** like the client page has. And the big next step: **LinkedIn**. Find where the LinkedIn data actually lives, then restructure each client page into an **Overview (both channels) / Email / LinkedIn** tab set — connection requests sent, accepted, positive replies, campaigns running — keeping the channels separate so you can focus on each, with "maybe a total".

---

## A — The AP ratio investigation (what the logic actually was)

**Your numbers reproduce exactly, and there were three separate things going on:**

1. **Window mismatch — the main driver.** The client-page ratios are **range-scoped** (that week AP had 4,427 sends ÷ 5 positives = **885**, and 3,835 contacts ÷ 5 = **767** — your 758/885 seen a day earlier). The campaign card's "33" is **lifetime positives** (its lifetime ratio is 830 emails/pos — actually consistent with 885). Two different windows sat side by side without saying so.
2. **Follow-ups WERE in the ratio inputs — your hypothesis was right in principle, small in practice.** That week they were 20 of AP's 4,427 sends (0.5%). But conceptually they don't belong: follow-up/referral sends happen **after** a positive reply, and their "positives" are re-engagements of already-won leads.
3. **A one-day data incident made contacts vs emails look weirder than reality.** On **16 Jul** the live send-event capture dropped ~1,080 events (AP −624, Omnivate −450, PayCaptain −6) while the daily sync recorded the true sends — so the contacts number (event-based) undercounted vs emails (sync-based) on what is literally a 1-email-per-contact sequence. Flagged to the perf-plugin as an incident (with a recommendation: a daily events-vs-facts reconciliation alert); not a cockpit formula issue.

**The fix (Phase 1, shipped):**
- Both ratios are now **primary-campaigns-only, numerator AND denominator**, everywhere they appear (Command Center, client page, Daily Summary, Compare). Follow-up/referral campaigns no longer touch them. Totals cards (Sent, Positive Replies, Reply Rate) stay all-campaign — totals are totals.
- Every ratio card is labeled "**primary campaigns**" plus its window; the campaigns tab now states "**cards show lifetime totals · the tiles above follow the Period selector**" so range-vs-lifetime can't be misread again.
- Verified: AP primary-only that week = 4,407 sends / 4 positives / 3,827 contacts — ratios of 1,102 / 957, honestly labeled, reconciling to SQL.

## B — Compare date picker (Phase 2, shipped)

The same from–to picker the client page has now sits on Compare next to the presets. Applying custom dates overrides the preset (the label reads "Showing {from} → {to}"), clicking a preset exits the custom range, and every panel title carries the window.

## C — LinkedIn (Phases 3–4)

### Step one — where the data lives (your explicit ask)

Full discovery across the outbound system (skills, manual, scripts, n8n, Supabase):

- **Aimfox is the system of record** — one workspace + API key per client, metrics via its API (campaign metrics = sent/accepted/messages, reliable; its raw reply count **undercounts** — real replies come from the conversations endpoint / the response-agent decision log).
- **Nothing was persisted anywhere** — no table, no sync, no time series. The only Supabase footprint was per-lead Yes/No flags written by two hand-run scripts, plus the reply-decision audit log. Every prior report pulled Aimfox live, ad-hoc.
- **4 clients run LinkedIn** (Omnivate 1 campaign, Cylindo 4, AP 4, PayCaptain 2 — 11 total, campaign IDs mapped). **All paused since the 26 Jun QA hold.** Verified totals at that point: **1,603 connection requests sent · 361 accepted (22.5%) · ~81 messaged · 4 real offer replies · 1 positive** — and ~280 accepted connections never got their first message (a warm backlog + a resume-carefully risk).

### What was built (local-first, then shipped)

- **The missing data layer** (migration 028): `linkedin_campaigns` (registry: 11 campaigns, personas, targets, status) + `linkedin_daily_campaign_facts` (cumulative daily snapshots — the same registry-plus-daily-facts shape email already has). Seeded with the **verified 26 Jun review numbers — which are current reality, because the campaigns have been paused since that date.** The cockpit reads only these tables (it never calls external APIs live, by design).
- **Client tabs restructured** exactly as you described: **Overview** (both channels side by side, deep links into each, and ONE combined figure — all-time positives across channels, the only place windows genuinely match) · **Email** (the entire previous overview, content untouched) · **LinkedIn** (new).
- **The LinkedIn tab**: connection requests sent (vs targets loaded), accepted + acceptance rate, messages sent (with the "N accepted never messaged" warning), replies (labeled as the undercounting raw metric), verified positive replies, and the per-campaign table with per-sender personas and statuses. A loud banner states the paused/QA-hold status and the snapshot provenance — no number pretends to be live.

### The follow-up this sets up (not in this iteration)

A **daily Aimfox sync** (per-workspace keys, campaign metrics + conversations → `linkedin_daily_campaign_facts`) so the tab goes live-fresh when campaigns resume. That job belongs in the plugin/trigger stack with proper secret handling — proposed as its own ticket. Until then the seed stays correct while campaigns remain paused. *(Also flagged from discovery: the AP workspace key sits in plaintext in two scripts — worth rotating/moving to env.)*

---

## The plan at a glance

| Phase | What | Status |
|---|---|---|
| 1 | Ratio logic: primary-only both sides + window labeling + capture-gap flagged | ✅ Shipped 2026-07-21 |
| 2 | Compare: custom date-range picker | ✅ Shipped 2026-07-21 |
| 3 | LinkedIn discovery + the missing data layer (registry + daily facts, verified seed) | ✅ Shipped 2026-07-21 |
| 4 | Client tabs: Overview (both) / Email / LinkedIn | ✅ Shipped 2026-07-21 |
| 5 | Local-first QA (email untouched) → deploy → walkthrough | ✅ e2e green local + prod |

## Judgment calls to review live

1. **Ratio denominators are primary-positives** (not all positives) — "primary emails per primary positive" is the clean efficiency definition; a follow-up campaign's positive is a re-engagement, not a fresh win.
2. **The combined Overview sums only all-time positives** — every other cross-channel figure stays per-channel with its window stated, because email is range-scoped and LinkedIn is a paused cumulative snapshot; summing unlike windows is exactly what confused AP's numbers.
3. **LinkedIn seed = the verified 26 Jun review** (Aimfox metrics for sent/accepted/messages; verified reply view for positives). Correct while paused; the daily sync keeps it honest after resume.
4. **Omnivate's Aimfox campaign UUID** exists only as a prefix in the docs — registry carries the prefix with a note; the sync job will store the full id from the API.
