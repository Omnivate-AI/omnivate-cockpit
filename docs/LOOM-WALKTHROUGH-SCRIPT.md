# Omnivate Cockpit — Loom Walkthrough Script

**For:** Amzat's Loom to Omar · **Date:** 2026-07-07 · **App:** https://omnivate-cockpit.vercel.app
**How to use this:** it's laid out as a recording route — go screen by screen, top to bottom. For each item you get **what Omar asked → how it was fixed (plain + the mini technical step) → what to show on screen.** Demo client throughout is **Cylindo** (richest data). Every action point is tagged to its requirement (R1–R12) so Omar can tick them off.

> ⚠️ **One thing to settle before you hit record — the Ready Bank (R9).** A proof-check found a labelling issue (details at the very bottom). Don't film the Ready Bank "Qualified" number until we've decided how to handle it. Everything else is solid to film now.

---

## The recording route (click-path)
1. **Browser tab** — favicon + name (5 sec opener)
2. **Command Center** (home) — runway sliders · actionable-alerts KPI · send-targets removed · at-risk visibility
3. **Alerts page** — actionable vs maintenance tiers · the two new alerts
4. **Cylindo → Overview tab** — Ready Bank *(hold — see note)*
5. **Cylindo → Campaigns tab** — active/past · Primary/Follow-up/Referral · Mark done
6. **Cylindo → Mailboxes tab** — capacity breakdown · burnt "Needs Action" · Decisions panel (approve/deny)

## Requirement → where to show it (quick map)
| Req | Show it here |
|---|---|
| R1 data from Supabase, daily freshness | Command Center "Data Freshness" panel |
| R2 alerts rebuilt (tiers) | Alerts page — tier filter + counts |
| R3 lead-runway alert | Alerts page — the Cylindo runway alert |
| R4 campaigns active/past + labels + mark-done | Campaigns tab |
| R5 runway slider per client | Command Center — client cards |
| R6 runway calc trustworthy | Command Center card / Overview runway gauge |
| R7 send-floor alert | Alerts page — the PayCaptain send-floor alert |
| R8 burnt/at-risk visible & correct | Mailboxes tab — "Needs Action" card |
| R9 Ready Bank | Overview tab *(hold)* |
| R10 capacity breakdown | Mailboxes tab — "Rotation Groups & Capacity" |
| R11 actions from the UI | Mailboxes tab — "Infrastructure Decisions" panel |
| R12 parked | (nothing to show — say it's intentionally deferred) |
| + favicon/rename | Browser tab |

---

## 1. Browser tab — favicon + name
- **Asked (07-07 standup):** "We don't have the Omnivate favicon… call it something cool" (it was "Deliverability Hub").
- **How fixed:** renamed the app to **Omnivate Cockpit** and added the Omnivate brain-circuit mark as the tab icon. *Mini technical step: cropped the square icon out of the Omnivate logo, dropped it in as the app icon, and changed the app's title text.*
- **Show:** just point at the browser tab — the purple mark + "Omnivate Cockpit".

## 2. Command Center (home)

**Per-client runway slider — R5**
- **Asked:** on the front page, one visual read per client of how close they are to running out of leads, summed across their campaigns.
- **How fixed:** each client card now has a bar showing completed / in-progress / not-started leads across their active primary campaigns. *Mini technical step: a saved query sums the lead stages per client, and the card draws it as a slider.*
- **Show:** the client cards — point at Cylindo's near-empty bar.

**"Actionable Alerts" number — R2**
- **Asked:** Omar didn't trust the old alert count.
- **How fixed:** the headline number now counts only *actionable* alerts (things needing a human), not routine self-healing noise. *Mini technical step: every alert type is tagged actionable-or-maintenance, and the front-page counter only sums the actionable ones.*
- **Show:** the "Actionable Alerts" KPI tile. Say: "Cylindo went from 28 noisy alerts to 6 real ones."

**Send-targets chart removed — R7 (part 1)**
- **Asked:** the old send-targets chart wasn't useful — remove it.
- **How fixed:** deleted it. *Mini technical step: removed the component and its data call; the send-target idea came back as an alert instead (see Alerts page).*
- **Show:** nothing to point at — mention it's gone and the target logic moved into alerts.

**Runway is trustworthy now — R6**
- **Asked:** PayCaptain's runway "looked wrong."
- **How fixed:** the math was actually right (a big lead top-up had moved it), but it was counting the wrong campaigns. Now it counts only the main (primary) campaigns and the gauge shows its own working. *Mini technical step: a saved query separates primary from follow-up/referral campaigns so runway only reflects primaries.*
- **Show:** hover a client's runway — it reads like "N emails ÷ per-day = days."

**Data freshness — R1**
- **Show:** the "Data Freshness" panel — say everything is read from our own Supabase tables, refreshed once each morning; nothing calls Smartlead live.

## 3. Alerts page

**Alerts rebuilt into tiers — R2**
- **Asked:** strip the untrusted alert system, rebuild only what matters.
- **How fixed:** every alert is now either **Actionable** (act now) or **Maintenance** (self-heals). The page defaults to Actionable; Maintenance is opt-in behind a filter. *Mini technical step: a single tagging rule in the database labels each alert type, and the page + all counts respect it.*
- **Show:** the tier filter dropdown — flip between Actionable and Maintenance so Omar sees the noise is still there but hidden by default.

**Lead-runway alert — R3**
- **Asked:** alert me when a client is about to run out of leads — primary campaigns only, and don't nag about finished ones.
- **How fixed:** a morning check raises an alert per client based on primary-campaign runway; it clears itself when you top up, and skips campaigns you've marked done. *Mini technical step: a scheduled 09:20 job writes/clears these alerts into the alerts table.*
- **Show:** the live alert — **"Cylindo has ~0.2 days of primary lead runway."**

**Send-floor alert — R7 (part 2)**
- **Asked (revision):** keep a send target after all — a set minimum per client, alert if weekday sending drops below it, ignore weekends.
- **How fixed:** a morning check compares yesterday's sends to each client's minimum, does nothing on weekends, and clears itself on recovery. The number is editable per client. *Mini technical step: a scheduled 09:25 job that skips Sat/Sun.*
- **Show:** the live alert — **"PayCaptain sent 1,555 vs the 3,000/day minimum."**

## 4. Cylindo → Overview tab

**Ready Bank — R9** — ⚠️ **hold; see the verification note at the bottom before filming the numbers.**
- **Asked:** per client, how many good leads are left to reach out to.
- **How fixed:** replaced the confusing old funnel with a Ready Bank showing total leads → verified emails → LinkedIn-only → already in a campaign → **still available to contact**. *Mini technical step: the counts are tallied once each morning and saved, so the page loads instantly instead of scanning 90,000 rows.*
- **Show (safe bits):** the layout and the "available" headline concept. **Do not narrate the "Qualified" figure yet** — see note.

## 5. Cylindo → Campaigns tab

**Active + past campaigns — R4**
- **Asked:** show active *and* past campaigns, comparable.
- **How fixed:** the tab lists everything now; past campaigns sit in a collapsible section. *Mini technical step: the query stopped filtering to only-active and the page splits them by real Smartlead status.*
- **Show:** expand the "Past Campaigns" section.

**Correct labels — R4**
- **Asked:** referral campaigns were mislabelled.
- **How fixed:** campaigns now correctly tag **Primary / Follow-up / Referral**. *Mini technical step: a saved query classifies each campaign and the chip reads from it.*
- **Show:** point at a Referral-tagged campaign.

**Mark done — R4/R3**
- **Asked:** finished campaigns kept looking active and nagging (the Design Studios case).
- **How fixed:** a one-click "Mark done" that stops a campaign counting toward runway and alerts; reversible. *Mini technical step: the button writes an override flag the runway logic respects.*
- **Show:** the Mark-done control on a campaign row.

## 6. Cylindo → Mailboxes tab

**Capacity breakdown — R10**
- **Asked:** capacity three ways — Group A alone, all mailboxes, and reserves.
- **How fixed:** a "Rotation Groups & Capacity" card shows Group A, Group B, the whole pool, and the reserve bench, each with real emails-per-day, and badges whichever group is sending this week. *Mini technical step: a saved query groups mailboxes by their rotation group and sums their daily caps.*
- **Show:** the card — point at the "sending this week" badge.

**Burnt "Needs Action" fix — R8**
- **Asked:** the burnt-mailbox card said zero while boxes were actually burnt.
- **How fixed:** it now counts boxes below the health line that are *still in play*, not just ones already retired. *Mini technical step: changed the count from "officially burnt" to "below 97% and still live."*
- **Show:** the "Needs Action" card — Cylindo shows the 2 boxes needing a swap.

**Infrastructure Decisions panel — R11 (the big one)**
- **Asked:** act from the dashboard — see a problem, press a button — instead of scrolling Slack.
- **How fixed:** the tab now shows the email-infra system's pending decisions (e.g. "order mailboxes"), each with a plain summary, projected cost, and **Approve / Deny** buttons that do exactly what the Slack button does. Approving never spends — the actual purchase stays a separate supervised step. *Mini technical step: the cockpit reads and writes the same decisions list the email-infra engines already run on, so there's one source of truth and no second machine.*
- **Show:** the "Infrastructure Decisions" panel with Cylindo's open order decision(s) and the Approve/Deny buttons. Mention the "swap in reserves" action is built but intentionally switched off pending sign-off.

**Closing line for the Loom:** all 12 requirements from the review are done and live; execution of infra actions stays with the supervised email-infra runs; the only open items are ops (topping up Cylindo's leads, swapping its 2 burnt boxes) and the Ready Bank label question below.

---

## ⚠️ Ready Bank verification note (R9) — the proof-check Omar asked for

I checked exactly how the Ready Bank counts Cylindo and found the thing Omar suspected — the lead schema hasn't been fully adhered to, so one label overstates. **The numbers are correct for what they measure; the word "Qualified" is the problem.**

**What it's built on:** the Ready Bank reads Cylindo's `v_cylindo_tam` view. That view decides who's "in" using **`lead_status`** (not disqualified, or disqualified only for an email reason) — it does **not** filter on the actual **`qualification_decision`** column.

**The finding (live Cylindo numbers today):**
- Ready Bank "Qualified (TAM)" = **91,253**. But only **60,713** of those actually have `qualification_decision = 'qualified'`. The rest: **28,043 were never given a qualification decision at all** (blank), 2,283 not-qualified, ~200 other. → So "Qualified" is overstated by ~30k; that blank-decision 28k is the schema gap Omar flagged.
- "Verified emails" = 39,409, but **11,660 of those aren't marked qualified** either.
- "In a campaign" — I used the "uploaded to Smartlead" flag (**37,102**). There are two other signals that disagree: the canonical "actually emailed" view says **35,294**, and an older `actually_emailed` column says **21,121** (looks like a stale snapshot). Per our own rules the live "actually emailed" view (35,294) is the one to trust for "contacted."

**What I recommend (cockpit-side, safe, doesn't touch the databases Omar wants to revalidate):**
1. Relabel the big number **"Total reachable (TAM)"** and add a separate true **"Qualified"** line using `qualification_decision = 'qualified'`.
2. Switch "in a campaign / contacted" to the canonical **actually-emailed view**.
3. Leave the deeper fix — the 28k Cylindo leads with no qualification decision — as the schema-revalidation Omar owns (context, not action now).

---

## Clarifying questions before I go further
1. **Ready Bank:** want me to apply the 2 cockpit-side fixes above (relabel + add true Qualified + use the actually-emailed view) **before** you film — so the Loom shows correct labels — or leave it and you'll caveat it verbally?
2. **App name:** "Omnivate Cockpit" good, or does Omar want a different "something cool"?
3. **Loom scope:** this script covers the internal-software requirements. Do you also want the two ops findings (Cylindo lead top-up + 2 burnt boxes) in the video, or keep those separate?
