# Omnivate Cockpit — Requirements One-Pager

**From:** Amzat · **For:** Omar · **Source:** our internal-software walkthrough (Mon 6 Jul) · **Purpose:** confirm I understood the requirements — flag anything I got wrong.

## What this software is

One place where the team sees **how every client is performing** and **manages email infrastructure** — reading everything from our Supabase (`sp_*`) tables, refreshed by the daily morning sync. Accuracy bar: **correct for the last 24 hours.** Real-time is a future nice-to-have, only if seamless.

Two ground rules you set:
1. **UX is what makes this useful** — every number must explain itself, or it gets removed. Anything you don't trust gets stripped and rebuilt section by section.
2. **We iterate fast** — small changes, quick back-and-forth, not big-bang releases.

## The requirements as I understood them

| # | Requirement (your words, condensed) | Status |
|---|---|---|
| R1 | **Dashboard = reflection of Supabase**, updated by the once-a-day sync. No live Smartlead dependency. | ✅ Live |
| R2 | **Strip the alert system** ("I don't trust any of this") and **rebuild section by section**, only alerts that matter. | ✅ Live — alerts split into *actionable* vs *maintenance*; top-line counts show actionable only (Cylindo 28 → 6) |
| R3 | **Alert #1: running out of leads** — per client, **primary campaigns only** (never follow-up/referral), and finished campaigns must not nag daily. | ✅ Live — daily rule + auto-resolve; fired "Cylindo: 0.83 days" on first run |
| R4 | **Campaigns view: active AND past** with a toggle, all campaigns comparable, keeping the visual not-started / in-progress / completed breakdown. | ✅ Live — plus a **Mark done** button (Smartlead never auto-completes; Design Studios case) |
| R5 | **Command Center: one runway view per client** — summed across its active campaigns, as a visual slider; calculation **mirrors the smartlead-perf plugin**. | ✅ Live — slider on every client card; gauge shows its own formula (N emails ÷ cap/day) |
| R6 | The PayCaptain **31.8 days looked wrong — verify it.** | ✅ Verified — the math was faithful to the plugin; the number moved because 7,248 leads were added Jul 2. Runway is now primary-scoped and shows its inputs. |
| R7 | **Send Targets component: remove it** (not useful as implemented; min-sends-per-day alert idea parked for later). | ✅ Removed |
| R8 | **Burnt/at-risk mailboxes must be visible and correct** — the card said zero while boxes were burnt ("this is not working"). | ✅ Fixed — card now counts boxes below 97% still in play; investigated both flagged clients (Cylindo: real burn on digitalcylindopro.com; AP: stale data row, not a burn) |
| R9 | **Ready Bank per client:** total qualified TAM → how many with verified emails → LinkedIn-only (no email) → already contacted / in a campaign → **still available to reach out to**. | ✅ Live — replaces the old lead-pipeline section; Cylindo shows 5,597 available while its campaigns run dry |
| R10 | **Mailboxes tab: all boxes correctly broken down** + sending capacity as: **Group A alone · all mailboxes together · reserves count + reserve capacity**. | ✅ Live — rotation card with "sending this week" badge |
| R11 | **Actions from the UI — the strategic priority.** See a burnt mailbox → press a button → order / swap in reserves, with alerts organised under each client instead of Slack-scrolling. Read-only detection is the baseline; actions get built first, robustness features after. | 🔜 **Next sprint (Build-5).** Design settled: the cockpit triggers the same email-infra engines we already trust (Slack-approval flow included) — one source of truth for infra changes. First button: "swap in reserves" on the burnt card. |
| R12 | **Explicitly parked by you:** placement-test alerts, additional alert types, live sync, "many other things". | ⏸ Not started, on purpose |

## The three decisions I'd like you to confirm

1. **Runway alert thresholds:** warning at ≤7 days, critical at ≤3 (per-client configurable). OK?
2. **"Already contacted / in a campaign"** is defined as *uploaded to Smartlead* (covers contacted + queued). OK?
3. **Build-5 scope for the first pass:** swap-in-reserves + order buttons on the Mailboxes tab, wired to the existing email-infra engines with the Slack approval step kept. OK to proceed on that basis?

*Everything marked ✅ is live at omnivate-cockpit.vercel.app now — fastest review is: Command Center → Cylindo → Overview / Campaigns / Mailboxes tabs.*
