# Omnivate Cockpit — V3 Iteration Plan

**Prepared by:** Amzat · **For:** Omar's review and sign-off · **Date:** 2026-07-20
**Scope:** the third iteration of the cockpit, built directly from your V2 review Loom (2026-07-19)
**Live app:** https://omnivate-cockpit.vercel.app · **Repo:** `Omnivate-AI/omnivate-cockpit`

This is the requirements document for V3. It captures every action point from your walkthrough of the V2 app, groups them into phases with clear acceptance criteria, and flags the one item that needs a decision from you before it's built. Structure mirrors the V2 plan so it reviews the same way. The tracker below reflects live status as phases ship.

> **Source:** Omar's Loom review of V2, transcribed and cross-checked against the video by Amzat. 23 action points across 9 surfaces, all confirmed.

---

## Your review in one paragraph

The V2 rebuild landed, and this pass is about **precision and trust**. Four themes: **(1) "Today" is lying** — the Command Center says *today* but shows *yesterday's* data, the default view should open on yesterday not a 7-day roll-up, and the send-vs-target window needs to be defined and honest. **(2) The send-target settings are buggy** — updating a target doesn't show up, and one client's displayed target doesn't match its setting. **(3) The client page has grown clutter and needs the graph story tightened** — duplicate cards, a bar in the wrong place, positive-replies should lead, weekends should be visible, and one anomaly is breaking a whole chart. **(4) Some numbers are still wrong** — provider performance is attributing sends to SMTP we don't use, and the Ready Bank counts don't reconcile to what "qualified / verified / LinkedIn-only" actually mean. Plus a standing operational point: **at-risk and blacklisted mailboxes must be actioned the same day, every day** — which needs a quick decision on *how* (cockpit surface vs. an agent) before it's built.

---

## The plan at a glance

| Phase | What | Action points | Effort | Status |
|---|---|---|---|---|
| 1 | Command Center: "today"→"yesterday", default view, send-target bugs | A1–A5 | 1 session | ✅ Done — `docs/V3-PHASE1-COMMAND-CENTER.md` (build green; not yet pushed) |
| 2 | Two headline conversion metrics (emails/positive reply · contacts/positive reply) | B1, C1 | 1 session | ✅ Done — `docs/V3-PHASE2-CONVERSION-METRICS.md` (RPC live + verified; not yet pushed) |
| 3 | Client Overview restructure + graph reorder (positive replies on top, weekend shading, anomaly fix) | D1, D2, E1, E2, E3 | 1–2 sessions | ✅ Done — `docs/V3-PHASE3-OVERVIEW-RESTRUCTURE.md` (build green; visual pending live review; not yet pushed) |
| 4 | Provider Performance + Ready Bank data truth | E4, F1–F4 | 1–2 sessions | 🟡 E4/F1/F2/F3 done (DB fixes verified) — `docs/V3-PHASE4-DATA-TRUTH.md`; **F4 diagnosed + deferred** (needs Omar's "Converted" semantic); not yet pushed |
| 5 | Campaigns default state · domain-health chart · placement validity · blacklist reconciliation | G1, H1, H3 | 1 session | ✅ Done — `docs/V3-PHASE5-CAMPAIGNS-MAILBOXES-BLACKLIST.md` (blacklist DB fix verified: 36/33 → 0 confirmed; build green; not yet pushed) |
| 6 | At-risk / blacklisted / burnt action loop | I1, I2 | 1 session | 🟢 Cockpit surface done ("Needs Action Today") — `docs/V3-PHASE6-NEEDS-ACTION.md`; Option A built, agent auto-propose (B) = email-infra follow-up; not yet pushed |
| 7 | Final QA + Loom | — | 1 session | 🟢 Phases 1–6 committed (`b4f44b9`) + pushed to main → deployed; QA summary + Loom script in `docs/V3-PHASE7-QA-LOOM.md`; Loom recording + live sign-off = Omar |

**Schedule at sprint pace:** Day 1 → Phases 1 + 2 · Day 2 → Phase 3 + start Phase 4 · Day 3 → finish 4 + Phase 5 + Phase 7 QA/Loom. Phase 6 runs separately once its approach is decided. Roughly three working days for the cockpit fixes.

---

## The one decision we need from you (blocks Phase 6 only)

**How should the "action at-risk / blacklisted / burnt mailboxes every day" loop work?** You said in the review: *"we should never have mailboxes that are at risk or blacklisted that are not dealt with on the day… either you can use this or you can set up your own agent."* That's a design fork, not a bug fix:

- **Option A — Cockpit surface only:** a single "Needs action today" queue on the Command Center that lists every at-risk / blacklisted / burnt box with a one-click action (retire, rotate, replace) routed through the existing email-infra approval model. You process it manually each morning.
- **Option B — Agent-driven:** the email-infra plugin's daily routine auto-proposes the actions each morning; the cockpit is where you approve them. Less manual, more automation to trust.
- **Option C — Both:** the agent proposes, the cockpit queue is the human gate.

This spans the email-infra plugin (separate repo), so it needs one line from you on which way to go. Until then Phases 1–5 + 7 proceed and don't touch it. **Note:** part of this is really a *data-truth* fix that Phase 5 does anyway — see the blacklist reconciliation below.

---

## A theme that resolves three action points at once — the blacklist number

The cards show **AP 36 blacklisted / Cylindo 33**, and you flagged it twice ("we have so many blacklisted domains, we need to figure out what's going on") plus asked whether the placement test's **100% inbox / 0% spam** can be right "if they're all blacklisted."

The answer is already in hand from the estate-wide blacklist review: the **reconciled DNSBL truth is ~0 real listings** (the only genuine estate-wide listing was `huborbitalx.com`, since retired) — the V2 Blacklist Status card even shows *0 listed across 441 monitored domains*. So the "36 / 33" on the cards is the **noisy signal** (Smartlead's UI-only "Blacklisted" badge / shared-IP range noise), not real DNSBL listings — and the placement test showing 100% inbox is **consistent with the boxes not actually being blacklisted**.

**Fix (Phase 5):** the cockpit shows **one** blacklist number — the reconciled DNSBL truth — everywhere (card badge + breakdown + placement context), with the noisy count either dropped or clearly labeled as "Smartlead flag (unverified)". This closes **H1-adjacent, H3, and the data half of I1** in one move.

---

# The Phases

## Phase 1 — Command Center: "today", default view, and the send-target bugs

**Goal:** the first things you see when you open the app are honest and correct.

- **A1 · "Today" → "Yesterday".** The Command Center data is the last complete business day, not live. Relabel every "today" surface to read as **"Yesterday · {date}"** (or "latest complete day"), keeping the existing "synced {time}" freshness line. No live view is implied where none exists.
- **A5 · Default view = yesterday.** Open on the single-day (yesterday) view, not the 7-day roll-up — and it must **stick** when you navigate back from a client page (today it resets to 7 days every time). Applies to the Command Center time-range filter and the client page's default range.
- **A2 · Send-target update must propagate.** Updating a client's target in Settings (e.g. Omnivate 500 → 1,200) must reflect on the Command Center immediately, without a manual refresh. Root cause is almost certainly a stale Next.js cache on the settings write — fix with proper revalidation of the affected paths.
- **A3 · Displayed target must match the setting.** PayCaptain shows a **1,200** target in Settings but **3,000** in the 1-day view; Cylindo "breaks when updated." Reconcile the single `daily_email_target` field in Settings with the per-weekday target JSON the display sums (`getTargetForDate`), so what you set is what you see, and it scales correctly across day / 7-day / custom ranges.
- **A4 · Define and label the send-vs-target window.** State explicitly in the UI whether "below target" is measured over **N working days** (weekday-JSON aware, which is the intent) and don't render "below target" against an incomplete in-flight day. One clear label so nobody has to guess.

**Done when:** the Command Center opens on yesterday by default and stays there; every "today" reads as yesterday; changing any client's target in Settings shows the new number on the Command Center on the next view with no manual refresh; PayCaptain (and every client) shows its configured target in every range; the window is labeled. Build + tests green; screenshots confirm.

---

## Phase 2 — Two headline conversion metrics

**Goal:** the two efficiency numbers you've asked for twice, at the top and in the daily summary.

- **B1 · Top-level cards (across all campaigns, per time range — yesterday / last week / custom):**
  1. **Emails sent per positive reply** — how many emails to earn one positive reply.
  2. **Contacts per positive reply** — how many *people* to earn one positive reply.
  These differ once we send >1 email per person: at 1 email/person they're equal; at 2 they roughly double on the emails side. "Positive reply" = the confirmed definition (Interested + human_action_required).
- **C1 · Same two metrics in the daily summary** at the bottom, scoped to that day.

**Data:** positive replies and emails-sent already exist; **contacts** = distinct people emailed, taken from the canonical actually-emailed view (not the uploaded flag). Both metrics guard against divide-by-zero (show "—" when zero positive replies).

**Done when:** both metrics render as top cards that respond to the range selector, and appear in the daily summary; numbers reconcile to a hand recomputation for AP + Cylindo.

---

## Phase 3 — Client Overview restructure + graph reorder

**Goal:** cut the duplication, fix the layout order, and make the graph story lead with what matters.

- **D1 · Reconcile the contradicting positive-reply figures.** With a date range applied, one card shows 5 positive replies and another shows 0 — they must agree (or clearly answer different, labeled questions). Trace both to source and unify.
- **D2 · Restructure the header cards:** keep **one** positive-reply card (not two), keep **one** total-replies card (not two), move the **bar** that sits between the two rows to the **top**, and fix the all-time vs range labeling (today it reads "all time, all time" but one isn't). Layout = key metrics on top, their graphs below.
- **E1 · Positive replies graph leads.** Make it the **top** graph and redesign it for clarity — cleaner breakdown, clearer numbers, easier to read at a glance. (This is the "interested replies only" chart you pre-approved on 07-13.)
- **E2 · Weekend shading.** Grey out weekend columns/bands on every time-series chart so gaps read as weekends, not missing data.
- **E3 · Reply-rate trend anomaly fix.** A weekend spike (few/no sends + a stray response-agent reply = a huge rate) is skewing the y-axis and making the chart unreadable. Handle the anomaly (weekend-aware scaling / outlier clamping / exclude near-zero-send days), and move this chart to **last** in the order.

**Done when:** no duplicate cards, the bar is on top, positive-replies is the first graph and reads clearly, weekends are visibly shaded, the reply-rate chart is readable across a full month with no single day blowing out the axis, and it sits last. Screenshots + a short change-list for your review.

---

## Phase 4 — Provider Performance + Ready Bank data truth

**Goal:** the two number-correctness items from the review, fixed at source and re-verified.

- **E4 · Provider Performance "other" is wrong.** The 14-day card shows **6,131 from "other"/SMTP for AP**, but AP uses **no SMTP**. Trace the provider attribution (sender-side MX/tag classification) — the "other" bucket is catching sends that belong to Google/Microsoft. Fix the classification so the split is correct, and make the card honest where recipient-side capture has genuine gaps.
- **F1 · Ready Bank starts with qualified.** The first number is the **qualified** count (`qualification_decision = 'qualified'` — only qualified matters), and the next is **qualified AND email-verified**.
- **F2 · LinkedIn-only count is too low** — you know there are far more LinkedIn-only leads than shown. Fix the count against the canonical reachability view.
- **F3 · Verified+qualified count looks wrong / stale** — either fewer truly have verified emails, or the data is outdated. Reconcile to the live view; surface a data-gap note where the underlying column was never populated (per-client, as V2 established).
- **F4 · "Converted" is incorrect** — fix. (Positive replies + confidence are fine and stay.)

**Done when:** the provider split reconciles to the send-events ground truth for AP (no phantom SMTP); each Ready Bank line reconciles to a documented per-client definition (qualified → qualified+verified → LinkedIn-only → converted), and any schema gap is surfaced, not hidden.

---

## Phase 5 — Campaigns default state · domain-health chart · placement validity · blacklist truth

**Goal:** the remaining client-page items, plus the blacklist reconciliation that resolves the recurring "so many blacklisted" question.

- **G1 · Campaign default expand/collapse.** Only **active (primary)** campaigns expanded by default; **follow-up** and **referral** campaigns collapsed by default. (The classification already exists from V2.) *Pipelines = next round, out of scope.*
- **H1 · Domain-health / "weakest domain at risk" chart.** You still can't read what it's telling you. Either replace it with something that states a clear fact at a glance, or remove it — decision made in-build and flagged for review. **Keep** the resting / reserve / blacklisted **breakdown** (you liked it — H2, unchanged).
- **H3 · Placement-test validity.** Confirm the yesterday 100% inbox / 0% spam is real and explain it in context — which, per the blacklist reconciliation below, it is (the boxes aren't truly blacklisted).
- **Blacklist reconciliation (resolves the recurring theme + data half of I1):** show **one** blacklist number app-wide — the reconciled DNSBL truth — and drop or clearly de-rate the noisy "36 / 33" Smartlead-flag count.

**Done when:** campaign sections open with only active expanded; the domain-health chart either says something clear or is gone; the blacklist number is consistent everywhere and matches the reconciled DNSBL truth; placement validity is explained on the tab.

---

## Phase 6 — At-risk / blacklisted / burnt action loop  *(blocked on the decision above)*

**Goal:** nothing at-risk, blacklisted, or burnt sits undealt-with for a day.

- **I1 · Same-day action surface** for at-risk + blacklisted mailboxes (acting on the *reconciled* truth from Phase 5, so we chase real problems, not noise).
- **I2 · Burnt-mailbox alerts** (currently days old) get an action workflow — retire/replace/rotate through the email-infra approval model.

Shape depends on the Option A / B / C decision. Spans the email-infra plugin (separate repo) — will be its own PR there if it needs a plugin-side change.

**Done when:** defined once the approach is chosen.

---

## Phase 7 — Final QA + Loom

- Full regression: tests updated for the V3 surface, green against production; dark-mode + mobile spot-checks on every changed page.
- Numbers re-verified vs Smartlead for AP + Cylindo across day / 7-day / custom ranges.
- **Loom:** a fresh walkthrough — "here's each thing you asked for, here's where it lives now, here's the proof it reconciles."

**Done when:** tests green, Loom sent, V3 closed.

---

## What we're deliberately NOT changing (you liked these, or they're out of scope)

The date-range picker (you like it — kept) · the resting/reserve/blacklisted mailbox **breakdown** (H2 — kept) · Ready Bank positive-replies + confidence (working — untouched) · the **Pipelines** tab (explicitly next round) · everything V2 shipped that the review didn't flag (email-infra strip, decisions panel, orders, interested-leads tab, compare page, audit log, settings mechanics).

---

## Working method

- Phase-by-phase, one focused session each, mirroring V2's rhythm.
- One doc per phase capturing what changed + the reconciliation proof (`docs/V3-PHASE{N}-*.md`), same as V2.
- Each phase: build → tests green → screenshots/number-proof → your review on the live URL.
- Deploy cadence to be confirmed (branch + PR vs. commit-to-main as V2 did) — see the chat note.
