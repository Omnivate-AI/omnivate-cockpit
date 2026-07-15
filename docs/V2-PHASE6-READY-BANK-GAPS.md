# Phase 6 — Ready Bank: Per-Client Definitions + The Schema-Gap List

**For:** Omar (ops decisions) · **From:** Amzat · **Date:** 2026-07-14
**Context:** V2 Phase 6 reconciled every client's Ready Bank against the canonical qualification rules (`knowledge/system-rules/lead-table-qualification-schema.md`) and live Smartlead contact truth. The card now shows these corrected numbers with the definitions visible in the UI (ⓘ block). This doc is the reconciliation record + the gaps that are **ops decisions, not cockpit fixes**.

## The reconciliation (2026-07-14, TAM-scoped)

| Line | Acceleration Partners | Cylindo | PayCaptain | Omnivate |
|---|---|---|---|---|
| Total reachable (TAM) | 65,978 | 44,940 | 92,967 | 263,519 |
| Qualified | **54,480** | **22,918** | **Not tracked** | **Not tracked** |
| — undecided | 11,495 | 21,966 | (92,769 undecided) | (no column) |
| Verified email | 33,444 | 28,923 | 51,024 | 115,509 |
| LinkedIn-only | 10 | 13,256 | 136 | 0 |
| Emailed (live truth) | 23,685 | 20,120 | 25,150 | 1,027 |
| ~~"In campaign" per uploaded flag~~ | ~~27,411~~ | ~~26,204~~ | ~~28,985~~ | ~~5,901~~ |
| Available (conservative) | 6,403 | 2,920 | 22,821 | 109,608 |

**What changed and why:**
- **"Emailed" replaces "In campaigns."** The old line counted `smartlead_uploaded` — an upload flag, not contact truth. It overstated on every client (AP +3,730, Cylindo +6,084, PayCaptain +3,835, Omnivate +4,874). The new line joins the TAM to `v_{slug}_actually_emailed` — the live view over Smartlead send events ∪ repliers ∪ the pre-tracking historical floor. This is the same truth standard the schema rules mandate (derive, don't snapshot).
- **"Qualified" now says "Not tracked" where that's the truth.** Omnivate's table has no qualification verdict column; PayCaptain's exists but holds verdicts on 193 of 92,967 rows (0.2% — a pass never ran). Both previously rendered as a fake near-zero behind a client-side guess.
- **"Available" is conservative:** verified email AND never emailed AND not uploaded anywhere. Leads uploaded-but-never-emailed are *not* counted available (they're queued in a campaign or are stale uploads — see gap 3).

## The gap list — your decisions

**1. PayCaptain qualification never ran (92,769 undecided).** The table gates on title + email verification only. Decide: run an AI qualification pass over the ~51k verified-email TAM (cost: roughly the standard two-gate qual pipeline), or accept title+verification as PayCaptain's qualification standard and we mark the line "by design" instead of "not tracked".

**2. Undecided backlogs on the tracked clients.** Cylindo: 21,966 of its fit-gated TAM have no verdict (this is the "28k" from the plan, now measured post-fit-gate). AP: 11,495. These leads sit in "Total reachable" but not in "Qualified" — deciding them is a pipeline run each.

**3. Uploaded-but-never-emailed cohorts (~18.5k across clients).** AP 3,726 · Cylindo ~6,084 · PayCaptain 3,835 · Omnivate 4,874. Some are queued in active campaigns (will send), most are stale uploads from paused/completed campaigns. They're excluded from "Available" today. Recycling them into fresh campaigns is an ops call — they're visible as the amber segment on the card's bar.

**4. Omnivate has no qualification tracking at all** (263k TAM, 115k verified). If Omnivate outbound resumes seriously, the table needs the standard qualification columns per the schema rules.

**5. Cylindo ledger drift (for the back-sync project, not urgent).** The `smartlead_emailed` column the daily ledger back-sync maintains says 17,683; the live view says 20,120 (−2,437). The back-sync likely misses the repliers-union or the historical floor. The cockpit reads the live view so it's unaffected — but anything else trusting that column undercounts. Belongs to the Universal Lead Ledger project (ClickUp 869e3jxgx).

**6. AP LinkedIn-only = 10.** Not a bug in the card — AP's TAM has essentially no email-failed-but-linkedin-reachable leads (its list was built email-first). Noting it so the near-zero doesn't read as broken.

## Where the numbers live

- Snapshot: `cockpit_ready_bank_daily`, refreshed daily 09:12 UTC by `fn_cockpit_snapshot_ready_bank()` (migration 018 — per-client blocks, EXCEPTION-guarded).
- Card: client page → Overview → Ready Bank; the ⓘ "What these numbers mean for this client" block carries these definitions in-UI.
- The daily cron now computes the actually-emailed join live each morning; if a client's block ever fails, the previous day's row survives and the failure is a Postgres WARNING.
