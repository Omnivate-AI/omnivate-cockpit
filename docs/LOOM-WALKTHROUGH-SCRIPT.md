# Omnivate Cockpit — Loom Walkthrough Script

**For:** Amzat's Loom to Omar · **Date:** 2026-07-07 · **App:** https://omnivate-cockpit.vercel.app
**How to use this:** it's a recording route — go screen by screen, top to bottom. Each item gives you **what Omar asked → how it was fixed (plain + the mini technical step) → what to show on screen.** Demo client throughout is **Cylindo** (richest data). Every action point is tagged to its requirement (R1–R12) so Omar can tick them off. **Part 7 covers the extra work done beyond the 12 action points** — worth talking through too.

> **On numbers:** everything refreshes daily, so read whatever's on screen live — the figures below are this-week examples so you know what "right" looks like.
> **On the Ready Bank:** we're deliberately leaving it as-is and *explaining* the labelling quirk on camera (not hiding or rushing a fix) — the exact talking track is in §4. The fix comes after this review, once we've gathered feedback.

---

## The recording route (click-path)
1. **Browser tab** — favicon + name
2. **Command Center** (home) — runway sliders · actionable-alerts KPI · send-targets removed · freshness
3. **Alerts page** — actionable vs maintenance tiers · the two new alerts
4. **Cylindo → Overview tab** — Ready Bank (with the honest explanation)
5. **Cylindo → Campaigns tab** — active/past · Primary/Follow-up/Referral · Mark done
6. **Cylindo → Mailboxes tab** — capacity breakdown · burnt "Needs Action" · Decisions panel
7. **Talk-through** — the work done beyond the action points

## Requirement → where to show it
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
| R9 Ready Bank | Overview tab |
| R10 capacity breakdown | Mailboxes tab — "Rotation Groups & Capacity" |
| R11 actions from the UI | Mailboxes tab — "Infrastructure Decisions" panel |
| R12 parked | (say it's intentionally deferred) |
| + favicon/rename | Browser tab |

---

## 1. Browser tab — favicon + name
- **Asked (07-07 standup):** no Omnivate favicon, and it was named "Deliverability Hub" — "call it something cool."
- **How fixed:** renamed to **Omnivate Cockpit** with the Omnivate brain-circuit mark as the tab icon. *Mini step: cropped the square icon out of the Omnivate logo, set it as the app icon, changed the title text.*
- **Show:** point at the browser tab — purple mark + "Omnivate Cockpit."

## 2. Command Center (home)

**Per-client runway slider — R5**
- **Asked:** one visual read per client of how close they are to running out of leads, summed across campaigns.
- **How fixed:** each client card has a bar showing completed / in-progress / not-started leads across their active primary campaigns. *Mini step: a saved query sums lead stages per client; the card draws the slider.*
- **Show:** the client cards — Cylindo's near-empty bar.

**"Actionable Alerts" number — R2**
- **Asked:** Omar didn't trust the old alert count.
- **How fixed:** the headline counts only *actionable* alerts, not routine self-healing noise. *Mini step: every alert type is tagged actionable-or-maintenance; the counter sums only actionable.*
- **Show:** the "Actionable Alerts" tile — "Cylindo went from 28 noisy alerts to 6 real ones."

**Send-targets chart removed — R7 (part 1)**
- **Asked:** the old send-targets chart wasn't useful — remove it.
- **How fixed:** deleted; the target idea came back as an alert instead (§3). *Mini step: removed the component + its data call.*
- **Show:** nothing to point at — mention it's gone and moved into alerts.

**Runway is trustworthy — R6**
- **Asked:** PayCaptain's runway "looked wrong."
- **How fixed:** the math was right (a big lead top-up had moved it) but it was counting the wrong campaigns — now only primary campaigns, and the gauge shows its own working. *Mini step: a saved query separates primary from follow-up/referral.*
- **Show:** hover a client's runway — reads like "N emails ÷ per-day = days."

**Data freshness — R1**
- **Show:** the "Data Freshness" panel — everything reads from our own Supabase tables, refreshed each morning; nothing calls Smartlead live.

## 3. Alerts page

**Alerts rebuilt into tiers — R2**
- **Asked:** strip the untrusted alert system, rebuild only what matters.
- **How fixed:** every alert is **Actionable** (act now) or **Maintenance** (self-heals); page defaults to Actionable, Maintenance is behind a filter. *Mini step: one tagging rule in the database that the page + all counts respect.*
- **Show:** flip the tier filter so Omar sees the noise still exists but is hidden by default.

**Lead-runway alert — R3**
- **Asked:** alert when a client is about to run out of leads — primary campaigns only, don't nag about finished ones.
- **How fixed:** a morning check raises one alert per client from primary-campaign runway; clears itself on top-up; skips campaigns marked done. *Mini step: a scheduled 09:20 job writes/clears these.*
- **Show:** the live alert — "Cylindo has ~0.2 days of primary lead runway."

**Send-floor alert — R7 (part 2)**
- **Asked (revision):** keep a send target after all — a set minimum per client, alert if weekday sending drops below it, ignore weekends.
- **How fixed:** a morning check compares yesterday's sends to each client's minimum, skips weekends, clears on recovery; number editable per client. *Mini step: a scheduled 09:25 job that does nothing on Sat/Sun.*
- **Show:** the live alert — "PayCaptain sent 1,555 vs the 3,000/day minimum."

## 4. Cylindo → Overview tab — Ready Bank (R9)

- **Asked:** per client, how many good leads are left to reach out to.
- **How fixed:** replaced the confusing old funnel with a Ready Bank: total leads → verified emails → LinkedIn-only → already in a campaign → **still available to contact**. *Mini step: the counts are tallied once each morning and saved, so the page loads instantly instead of scanning ~90,000 rows.*
- **Show (Cylindo, today's snapshot):** ~86,431 total · 36,928 verified email · 8,434 LinkedIn-only · 35,834 in a campaign · **5,597 still available.**

**Talking track — the honest caveat (say this on camera):**
> "One thing to flag on the Ready Bank, and it's the point Omar raised: this top number is really *everyone we can still reach*, not strictly leads stamped 'qualified.' Cylindo's been through many qualification passes, and when I checked, a big chunk — roughly a third — never had a qualification decision recorded at all. So the number's honest for 'who can we reach,' but the word 'Qualified' is doing too much work. Same with 'in a campaign' — we're using the 'uploaded to Smartlead' flag, which is one of three signals that don't perfectly agree. We're leaving this exactly as-is for now on purpose, so you can see the real state; the clean-up is the Cylindo schema revalidation, which we'll do after this review."

*(Reference detail, if asked — from a live check today: of the leads in the reachable set, ~60,700 carry `qualification_decision = 'qualified'` and ~28,000 carry none; "contacted" reads 37,102 by the uploaded flag vs 35,294 by the canonical actually-emailed view vs 21,121 by an older column. Numbers drift daily; the pattern is the point.)*

## 5. Cylindo → Campaigns tab

**Active + past campaigns — R4**
- **Asked:** show active *and* past campaigns, comparable.
- **How fixed:** lists everything now; past campaigns in a collapsible section. *Mini step: query stopped filtering to only-active; page splits by real Smartlead status.*
- **Show:** expand "Past Campaigns."

**Correct labels — R4**
- **Asked:** referral campaigns were mislabelled.
- **How fixed:** campaigns tag correctly **Primary / Follow-up / Referral**. *Mini step: a saved query classifies each; the chip reads from it.*
- **Show:** point at a Referral-tagged campaign.

**Mark done — R4/R3**
- **Asked:** finished campaigns kept looking active and nagging (Design Studios case).
- **How fixed:** one-click "Mark done" stops a campaign counting toward runway and alerts; reversible. *Mini step: the button writes an override flag the runway logic respects.*
- **Show:** the Mark-done control on a row.

## 6. Cylindo → Mailboxes tab

**Capacity breakdown — R10**
- **Asked:** capacity three ways — Group A alone, all mailboxes, reserves.
- **How fixed:** a "Rotation Groups & Capacity" card: Group A, Group B, whole pool, reserve bench, each with real emails-per-day, and a badge on whichever group sends this week. *Mini step: a saved query groups mailboxes by rotation group and sums their daily caps.*
- **Show:** the card + the "sending this week" badge.

**Burnt "Needs Action" fix — R8**
- **Asked:** the burnt-mailbox card said zero while boxes were actually burnt.
- **How fixed:** now counts boxes below the health line that are *still in play*, not just retired ones. *Mini step: changed the count from "officially burnt" to "below 97% and still live."*
- **Show:** the "Needs Action" card — Cylindo's 2 boxes needing a swap.

**Infrastructure Decisions panel — R11 (the big one)**
- **Asked:** act from the dashboard — see a problem, press a button — instead of scrolling Slack.
- **How fixed:** the tab shows the email-infra system's pending decisions (e.g. "order mailboxes"), each with a plain summary, projected cost, and **Approve / Deny** buttons that do exactly what the Slack button does. Approving never spends — the actual purchase stays a separate supervised step. *Mini step: the cockpit reads/writes the same decisions list the email-infra engines already run on — one source of truth, no second machine.*
- **Show:** the "Infrastructure Decisions" panel with Cylindo's open order decision(s) + Approve/Deny. Mention "swap in reserves" is built but intentionally switched off pending sign-off.

## 7. Beyond the action points — the extra work (talk through this)

These weren't on the 12-item list but are part of what got done — worth covering so Omar sees the full picture:

- **Everything runs off our own data (R1 foundation).** The whole app reads the shared Supabase tables our Smartlead + email-infra systems keep updated — no live Smartlead calls at all. That's what makes it fast and reliable.
- **Why the alert rebuild mattered — a real miss it fixed.** When I investigated Cylindo, the system *had* detected the burning mailboxes days earlier — the alert was just buried under ~20 routine maintenance alerts. The tiering (§3) is the permanent fix so a real problem can't drown in noise again.
- **The two at-risk clients Omar pointed at, investigated.** Cylindo = a *real* burn (two mailboxes on one domain still sending at 81–82%). Acceleration Partners = *not* a burn — a stale data row that hadn't updated since mid-June. Both now visible on the Mailboxes tab.
- **Three automatic morning jobs** keep it current: the lead-runway check, the Ready Bank counts, and the send-floor check — so the dashboard is always accurate to within a day (the bar Omar set).
- **How it was checked.** Every change was run through a code check, an automated robot that clicks through the live site, and a numbers cross-check against the database — the final pass ran against the real production site and passed.
- **Two things we deliberately dropped (07-07).** The manual "refresh" button and having the dashboard trigger execution — cut on purpose so there's one safe path: the cockpit approves, and the email-infra system's own supervised runs do the actual work. Nothing that spends money runs from the dashboard.
- **The paperwork.** The requirements one-pager (Omar-approved), an execution tracker, and this script — all kept in the project so anyone can pick it up.

**Closing line:** all 12 requirements are done and live, plus the favicon and the under-the-hood work; the only open items are the Cylindo ops (lead top-up + 2 burnt-box swaps) and the Ready Bank clean-up, which we're doing after this feedback round.

---

## Decisions locked (07-07)
- **App name:** Omnivate Cockpit — keeping it.
- **Ready Bank:** leave as-is, explain the caveat on camera, fix after feedback.
- **Loom scope:** everything top-to-bottom (action points + the Part 7 extras).
- **Docs:** this script, the one-pager (R1–R12), and the execution tracker are aligned — action points match the UI.
