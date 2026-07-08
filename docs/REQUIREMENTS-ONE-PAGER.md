# Omnivate Cockpit — Internal Software Requirements

**From:** Amzat · **For:** Omar · **Source:** our internal-software walkthrough (Mon 6 Jul) · **Purpose:** confirm I understood the requirements — flag anything I got wrong.

*Rev 2 (Tue 7 Jul): R7 revised per your ClickUp feedback — the send target stays, as a per-client weekday send-floor alert.*

## What this software is

One place where the team sees **how every client is performing** and **manages email infrastructure** — reading everything from our Supabase tables, refreshed by the daily morning sync. The accuracy bar is **correct for the last 24 hours**; real-time is a future nice-to-have, only if it can be done seamlessly.

Two ground rules you set:

1. **UX is what makes this useful** — every number must explain itself, or it gets removed. Anything you don't trust gets stripped and rebuilt section by section.
2. **We iterate fast** — small changes, quick back-and-forth, not big-bang releases.

## The requirements

**R1 — Data source & freshness.** The dashboard is a reflection of our Supabase tables, updated by the once-a-day sync. No live Smartlead dependency.

**R2 — Alerts, rebuilt from scratch.** Strip the existing alert system and bring alerts back section by section, only the ones that genuinely matter. An alert must mean "a human should act now" — routine self-healing noise never counts toward the headline numbers.

**R3 — Lead-runway alert (Alert #1).** Alert when a client is about to run out of leads: per client, counting **active primary campaigns only** — follow-up and referral campaigns never count. Finished campaigns must not nag daily; since Smartlead never auto-completes a campaign, an operator marks a campaign done and it stops counting.

**R4 — Campaigns view: active and past.** Show every campaign — active and past — with a toggle, all comparable side by side, keeping the visual not-started / in-progress / completed breakdown per campaign.

**R5 — Command Center runway.** One runway view per client on the Command Center: the summed picture across that client's active campaigns, shown as a visual slider of how much is left.

**R6 — Runway calculation.** The runway number mirrors the smartlead-perf plugin's calculation exactly, and is presented so it can be trusted at a glance — the number shows how it was derived.

**R7 — Send-floor alert.** The send target stays: a **specific minimum daily send number, settable per client**; if a client's sending falls below that number **on a weekday**, we get alerted. **Weekends never trigger the alert.** The old send-targets chart component stays removed — this lives in the alert system, with the number editable per client (Mailboxes tab → Sending Capacity card).

**R8 — Burnt / at-risk visibility.** Burnt and at-risk mailboxes must be visible and correct: when boxes are burnt the dashboard says so, per client, with what to do about it — no more "action required" cards reading zero.

**R9 — Ready Bank (replaces the lead-pipeline section).** Per client: total qualified TAM in our database → how many have a **verified working email** → how many are **LinkedIn-only** (no email) → how many we've **already contacted or have in a campaign** (defined as uploaded to Smartlead — contacted or queued) → and the headline number: how many are **still available to reach out to**.
> *Known caveat (07-07, being left as-is on purpose and explained in the Loom):* the "total" is built on **reachability** (`lead_status`), not strictly the **`qualification_decision`** column — for Cylindo ~a third of these leads never had a qualification decision recorded, so "Qualified" over-reads. The numbers are honest for "who can we reach." Clean-up = the Cylindo schema revalidation, deferred until after this feedback round.

**R10 — Mailbox breakdown & capacity.** The mailboxes view shows all mailboxes, correctly broken down, with sending capacity answered three ways: **Group A alone** (not A+B), **all mailboxes together**, and the **reserves** — how many we have and what their capacity would be.

**R11 — Actions from the UI (the strategic priority).** The software must let us act, not just see: spot a burnt mailbox → press a button → order new ones / swap in reserves — with alerts and actions organised under each client instead of scrolling Slack. Actions get prioritised to the top of the backlog; robustness features come after. Implementation direction from our conversation: the UI triggers the same email-infra engines we already run daily (keeping the Slack approval step), so there is one source of truth for infrastructure changes.

**R12 — Explicitly parked.** Placement-test alerts, additional alert types, live/real-time sync, and the other extras — deliberately out of scope for now.

---

## Status (07-07)

All 12 requirements are **built and live**, plus the Omnivate favicon + rename to **Omnivate Cockpit**. Two things were deliberately **dropped** by decision (07-07): the manual data-refresh button and having the dashboard trigger execution — the cockpit approves, the email-infra system's own supervised runs execute. R11's "swap in reserves" action is built but **switched off** pending sign-off.

For the screen-by-screen walkthrough (each action point → how fixed → where in the UI) **and the work done beyond these 12** (data foundation, the alert-noise root-cause fix, the two at-risk investigations, the morning jobs, testing, the dropped refresh), see **`LOOM-WALKTHROUGH-SCRIPT.md`**. These three docs are aligned — the action points match the UI.
