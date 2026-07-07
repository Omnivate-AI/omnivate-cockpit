# Omnivate Cockpit — Execution Plan & Tracker

**Owner:** Amzat · **Updated:** 2026-07-07 · **Source of truth for the internal-software task.**
Requirements are R1–R12 in `docs/REQUIREMENTS-ONE-PAGER.md` (Omar-approved, Rev 2). This file tracks execution against them.

**Headline:** 11 of 12 requirements DONE and live. The only remaining build is **R11 (actions from the UI / "Build-5")**. Everything else left is short ops/input items, not development.

---

## 1. DONE — shipped, verified live, on `main`

Each was verified when it shipped (e2e green · live data reconciled to the digit · alert rows observed firing · migrations confirmed applied).

| Req | What shipped | Commit |
|---|---|---|
| R1 | Dashboard reads `sp_*`, daily-sync freshness, no live Smartlead calls | migration 001–006 (prior) |
| R2 | Alert system stripped + rebuilt; actionable vs maintenance tiers; top-line counts actionable-only (Cylindo 28→6) | `53361a4` / mig 008 |
| R3 | Lead-runway alert — primary campaigns only, mark-done kill-switch, auto-resolve; fired Cylindo | `53361a4` / mig 007–008 |
| R4 | Campaigns tab: active + past split, class chips (primary/follow-up/referral), mark-done | `60c8134` / mig 009 |
| R5 | Command Center per-client runway slider | `a76afda` |
| R6 | Runway calc mirrors the perf plugin, shows its own inputs (PayCaptain 31.8d explained, not a bug) | `a76afda` / mig 007 |
| R7 | **Send-floor alert** (rev 2) — per-client weekday minimum, weekends skipped; fired PayCaptain 1,555 < 3,000 | `4a077ce` / mig 012 |
| R8 | Burnt/at-risk card fixed (counts boxes <97% still in play, not just lifecycle=burnt) | `53361a4` |
| R9 | Ready Bank — TAM → verified → LinkedIn-only → in-campaign → available; Cylindo 5,597 available | `60c8134` / mig 010 |
| R10 | Mailboxes: Group A / all / reserve capacity, "sending this week" badge | `60c8134` / mig 011 |
| R12 | Parked items (placement-test alerts, live sync, extras) — intentionally not built | — |

Also this session: the two at-risk clients investigated (Cylindo real burn on `digitalcylindopro.com`; AP = stale mirror row, not a burn), and the "why weren't we flagged" root cause fixed (burn was detected but drowned in maintenance noise → tier rebuild).

---

## 2. IN FLIGHT

Nothing mid-build. R7 (the last requirement revision) closed today. The board is clean to start R11.

---

## 3. LEFT TO DO — the execution queue (ordered)

### A. R11 — Actions from the UI ("Build-5") · Owner: Claude · the only remaining DEV work

**De-risked by today's discovery:** the cockpit does NOT need new infra. The plugin's `sp_decisions` table is the contract (`decision_type` · `proposed_payload` · `estimated_cost_usd` · `status`: proposed→pending→approved→executed · approval audit fields). The Slack Approve button only *marks* a decision approved — it never spends. `lifecycle_correction` decisions auto-execute on the next daily-routine run; `order_mailboxes` stays a separate supervised place-step. So the cockpit acts by **writing and approving decision rows in the plugin's own vocabulary**, and the existing engines execute them — one source of truth, no parallel action path.

- **5.0 — Decisions panel (read-only) · SAFE, no sign-off needed.** Per-client panel on the Mailboxes tab surfacing `sp_decisions` (proposed/pending/approved/executed) with type, payload summary, estimated cost, status, who approved. This alone delivers R11's "organised under each client instead of Slack-scrolling" for the *detection* half. Can start immediately.
- **5.1 — Propose + approve in the UI · needs the design gate (§5) — touches infra/spend.** "Swap in reserves" (Needs Action card) and "Order mailboxes" (capacity card) write a `proposed` decision (payload + cost shown before confirm). In-app approve/deny that writes the same `status` the Slack button writes (idempotent; both stay valid).
- **5.2 — Execute-now dispatch.** Approved decision → dispatch the infra routine via the PORT-1 GitHub-Actions pattern so it runs immediately instead of waiting for the daily cron; poll + surface result. **Prereq: PORT-1 secrets (item C1).**
- **5.3 — Guardrails + close-out.** Spend ceiling + double-confirm on anything that charges (fail-closed, matching the order-engine audit rule); e2e; docs; demo to Omar.

**Acceptance:** an operator can, from the Mailboxes tab, see all pending infra decisions, approve/deny one, and (for lifecycle) see it execute — without opening Slack or a terminal; nothing spends without an explicit money-confirm.

### B. Data-accuracy validation + Loom · Owner: Claude (compile) + Amzat (record) · Omar's open ask from 02 Jul
Formal markdown: spot-checks of app vs Supabase vs Smartlead, test matrix, confidence verdict. Evidence largely exists (every build reconciled to source). Claude compiles the doc (~1h); Amzat records the Loom over it. Closes a still-open assigned comment on the task.

### C. Amzat unblockers (~15 min total)
- **C1 — PORT-1 secrets** (checklist in `docs/HANDOVER-2026-07-03.md §2b`). Unlocks the refresh button AND Build-5 §5.2. *(Board #14)*
- **C2 — "Update Boxes" ops run** across all clients: drain burnt → deploy reserves → reorder. Note: an `order_mailboxes` decision has sat **pending since this morning** in `sp_decisions`, plus the Cylindo `digitalcylindopro.com` swap. Once 5.0 ships these are visible in the cockpit as they process. *(Board #15)*

### D. Omar inputs (fold into next message to him)
- Send-floor numbers for **Cylindo** + **Omnivate** (both unset = unmonitored).
- Sanity-check **PayCaptain 3,000/day** floor vs ~1,500 current Group-A capacity — it will alert daily until capacity or the number changes.

### E. Housekeeping · Owner: Claude
- Delta-pass the legacy `REQUIREMENTS.md` so it stops contradicting the one-pager (send-targets chart removed, funnel→Ready Bank, alert model superseded).
- Close Omar's superseded "recommended next steps markdown" comment (02 Jul) with a pointer to the one-pager + this plan.

---

## 4. Sequence to "task executed" (≈3 days, sprint pace)

- **Day 1** — 5.0 decisions panel (ships without any gate) → on design go: 5.1 propose+approve. Amzat clears C1 (PORT-1 secrets) in parallel.
- **Day 2** — 5.2 execute-now dispatch (needs C1). Claude compiles the data-validation markdown (B); Amzat records the Loom.
- **Day 3** — 5.3 guardrails + e2e + demo to Omar. Housekeeping (E). Amzat runs C2 (Update Boxes) with the cockpit now surfacing it.

Outcome: R11 closed → **all 12 requirements done**, data-accuracy signed off, infra actionable from the UI.

---

## 5. The one go/no-go gate (blocks 5.1+, not 5.0)

Build-5's action buttons will write and approve rows in the plugin's `sp_decisions`, and cockpit-approve writes the exact same `status='approved'` the Slack button writes (both remain valid; engines are indifferent to which approved it; money still needs an explicit confirm and, for orders, the supervised place-step). **This is infra that can spend — confirm the design and it's a go.** 5.0 (read-only) proceeds regardless.
