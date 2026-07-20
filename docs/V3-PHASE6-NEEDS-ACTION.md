# V3 Phase 6 — At-risk / burnt action loop (I1, I2)

**Status:** cockpit surface code complete · DB fix applied + verified · build green · **not yet pushed**
**Scope decision:** built **Option A / the cockpit human-gate half of C** (see below). Agent auto-propose (Option B) is an email-infra plugin follow-up.

---

## What was built — "Needs Action Today" on the Command Center

A cross-client panel, front-and-centre on the Command Center (right under the header, before the KPIs), so nothing at-risk/burnt/blacklisted sits undealt-with — Omar's *"we should never have mailboxes at risk or blacklisted that are not dealt with on the day."*

- Aggregates per client: **at-risk warmup boxes (<97%)**, **burnt boxes**, **confirmed blacklist listings** (Smartlead-badge noise excluded — Phase 5).
- Each client row links straight to `/clients/{slug}?tab=mailboxes`, where the **rest / rotate / retire** actions + the infra **decisions panel** already live (V2 Phase 7). The cockpit is the human gate; the email-infra engines remain the only actors — nothing spends or mutates from this panel.
- **All-clear** state (compact green line) when nothing needs action, so a clean day reads clean.
- Today it shows **AP 7 at-risk · Cylindo 11 at-risk** (0 burnt, 0 blacklisted) — the real signal, not badge noise.

`components/dashboard/needs-action-panel.tsx` + wired into `app/(dashboard)/page.tsx`. Portfolio view gains `burnt_mailboxes` (migration `cockpit_read_models_023.sql`, applied live).

## Reshaped by the Phase 5 blacklist finding

There is **no real blacklist fire** to chase daily — 0 confirmed DNSBL listings estate-wide (all 135 were Smartlead-badge noise). So the action loop correctly targets **at-risk warmup boxes + burnt boxes**, not the badge. I1's "blacklisted" half is satisfied by surfacing *confirmed* listings only (currently 0).

## Scope decision (I made the call, per "straight to Phase 6")

The A/B/C fork:
- **A — cockpit queue (BUILT):** a "deal with it today" surface you work through manually, routed to the existing in-app actions.
- **B — agent auto-propose:** the email-infra daily routine auto-raises the actions; needs an **email-infra plugin change (separate repo)** — a follow-up.
- **C — both:** agent proposes, cockpit is the human gate.

Built **A** (which is also C's cockpit half) because it's buildable in the cockpit now and delivers the daily-visibility Omar asked for.

### Option B status (investigated 2026-07-20) — ~80% already exists; ON HOLD

The email-infra `daily-routine.mjs` already implements most of B: Step 2 detects at-risk (`LOW_REP` warmup) → alert; Step 3 raises cockpit-approvable `sp_decisions`; Step 4 detects burn → alert (destructive handling kept out of auto-exec). The `raiseDecision()` → `sp_decisions` → cockpit DecisionsPanel approval loop is live.

**Remaining delta for full B:** turn the at-risk (LOW_REP) + burn findings into cockpit-approvable **action proposals** (rest/rotate/replace decisions) instead of plain alerts — a narrow change in daily-routine Steps 2/4.

**ON HOLD (Amzat, 2026-07-20):** the email-infra repo is mid-task — uncommitted burn-escalation WIP (`_escalate-burnt.mjs`, ClickUp 869e6kpka) on branch `feat/blacklist-badge-endpoint`. Not touching it to avoid colliding. Pick up the delta on a clean branch once that WIP lands.

## Verification
- Portfolio `burnt_mailboxes` verified (0 now); at-risk AP 7 / Cylindo 11.
- `npx tsc --noEmit` clean · `npm run build` compiled successfully.
- Live render (panel + all-clear + links) pending review on the deployed URL.
