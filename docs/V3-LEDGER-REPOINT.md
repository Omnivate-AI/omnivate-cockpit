# Universal Lead Ledger re-point — evidence + Loom script

**ClickUp:** [869e3knmx](https://app.clickup.com/t/869e3knmx) "Update internal app to use the consolidated lead-ledger schema"
**Shipped:** 2026-07-20 · migration `db/migrations/cockpit_read_models_025.sql` (applied live) + `lib/queries/ready-bank.ts` + `components/clients/ready-bank-card.tsx` copy
**Spec:** ClickUp attachment `internal-app-ledger-schema-brief.md`; canonical doc `knowledge/system-rules/lead-table-qualification-schema.md` § "The Universal Lead Ledger" (omnivate repo)

## What changed

Every lead-state metric in the app is computed by ONE SQL function —
`fn_cockpit_snapshot_ready_bank` (pg_cron `cockpit-ready-bank-daily`, 09:12 UTC)
→ `cockpit_ready_bank_daily` → the Ready Bank card + Command Center
`ready_leads`. The app's TypeScript never touches client lead tables directly,
so re-pointing that function re-points the entire app.

| Metric | OLD source (per-client improvisation) | NEW source (ledger standard, identical every client) |
|---|---|---|
| Total reachable | `v_{slug}_tam` count | unchanged — `v_{slug}_tam` is the blessed TAM view |
| Qualified | `qualification_decision` but hard-coded NULL for paycaptain/omnivate | `qualification_decision = 'qualified'`; "Not tracked" is now a uniform data rule (<1% of TAM judged) |
| Qualified + verified email | `qualification_decision` + TAM `email_reachable` | `qualification_decision = 'qualified' AND email_sendable` |
| Verified email | TAM `email_reachable` (built on the old per-client verification columns) | `email_sendable` (= `email_status` verified/catch_all_verified) |
| LinkedIn-only | TAM `linkedin_reachable AND NOT email_reachable` | `NOT email_sendable AND linkedin_url IS NOT NULL` |
| Emailed | join to `v_{slug}_actually_emailed` | `outreach_status IN ('emailed','replied')` |
| Available | verified AND not-in-view AND **`NOT smartlead_uploaded`** ← deprecated column | `email_sendable AND outreach_status = 'none'` |

The old function had 4 hand-written per-client arms; the new one is a single
template looped over the client roster — zero per-client SQL. The deprecated
`smartlead_uploaded` read is gone, so the pending `legacy_*` renames can no
longer freeze the snapshot.

Structural note: the TAM views were created 2026-07-01, before the ledger
columns landed (2026-07-12), and `SELECT *` freezes a view's column list at
creation — so they don't expose `outreach_status`/`email_sendable`. The
function therefore JOINs `v_{slug}_tam` (TAM membership, upstream-owned) to
`{slug}_leads` by `id` for the ledger columns. If upstream ever recreates the
TAM views, nothing here changes.

## Acceptance criteria → evidence

### 1. Standard understood
Brief + canonical doc read; `email_sendable` semantics verified empirically
(AP + Cylindo): `verified`/`catch_all_verified` → true, everything else →
false, NULL `email_status` → NULL (hence every read COALESCEs — the V3
Phase 4 F2 NULL-boolean lesson).

### 2. Every metric re-pointed, no per-client special-casing
Migration 025 (above). The only per-client variation left is data-driven:
a column-existence probe (omnivate lacks `qualification_decision` — upstream
gap) and the uniform <1%-judged "Not tracked" rule. No client names appear in
any counting SQL.

### 3. App figures reconcile with direct standard-column queries (2 clients)

Direct SQL run 2026-07-20 16:2x UTC against the standard columns, vs the
snapshot rows the app renders:

| Counter | AP direct | AP app | Cylindo direct | Cylindo app |
|---|---|---|---|---|
| Total reachable | 65,981 | 65,981 ✅ | 44,939 | 44,939 ✅ |
| Qualified | 54,470 | 54,470 ✅ | 22,908 | 22,908 ✅ |
| Qualified + verified | 30,869 | 30,869 ✅ | 15,059 | 15,059 ✅ |
| Verified email | 33,435 | 33,435 ✅ | 28,922 | 28,922 ✅ |
| LinkedIn-only | 32,362 | 32,362 ✅ | 13,256 | 13,256 ✅ |
| Emailed | 25,900 | 25,900 ✅ | 21,254 | 21,254 ✅ |
| Available | 6,403 | 6,403 ✅ | 2,919 | 2,919 ✅ |

7/7 exact on both clients. Sanity adjacents (all as expected):
`email_sendable=true` with a non-sendable `email_status` = **0** on both;
empty-string `linkedin_url` = **0** on both.

### 4. No deprecated column reads — grep proof

```
grep -rn -E "actually_emailed|smartlead_emailed|smartlead_uploaded|verified_email|core_list|uploaded_to_smartlead" lib/ app/ components/ types/
→ 2 hits, both explanatory comments in lib/queries/ready-bank.ts ("NOT the deprecated …")
grep db/migrations/cockpit_read_models_025.sql (the live fn)
→ 1 hit, the header comment describing what was removed
```

`email_verified` still appears as a **column of the app-owned snapshot table**
`cockpit_ready_bank_daily` (and its TS type) — that's the app's own vocabulary,
not a client-table read. Migrations 010–021 contain the old reads but are
superseded history; 025's `CREATE OR REPLACE` is the single live definition.

### 5. App is read-only on ledger columns — grep proof

Every Supabase write in the app targets app-owned or infra tables only:
`cockpit_alerts`, `sp_infra_alerts`, `client_analytics_config`,
`cockpit_campaign_overrides`, `sp_clients` (mailbox config), `sp_decisions`,
`sp_orders`, `app_settings`. **Zero writes to any `{slug}_leads` table.** The
snapshot function writes only `cockpit_ready_bank_daily`.

### 6. Loom → script at the bottom of this doc.

## Before → after (why some numbers moved)

Old fn ran 09:12; new fn re-ran 16:19 same day. Deltas are the old sources'
drift — i.e. the reason this task existed:

| Client | Counter | Before | After | Why |
|---|---|---|---|---|
| AP | Verified email | 33,444 | 33,435 | old TAM boolean was built on the old verification columns; net −9 vs ledger `email_sendable` (which also adds catch_all_verified) |
| AP | LinkedIn-only | 32,353 | 32,362 | the same 9 leads, no longer email-sendable → LinkedIn-reachable |
| AP | Emailed | 25,878 | 25,900 | ledger holds 22 emailed the live view misses (forward_gap=22 — repliers/floor arm) |
| Cylindo | Emailed | 21,638 | 21,254 | live view includes intraday sends after the 06:38 back-sync; ledger refreshes tomorrow 06:00 (probe: stale_gap 1,138 table-wide, fwd 0) |
| Omnivate | Available | 107,465 | 108,218 | +753 leads whose old `smartlead_uploaded` flag was stale — ledger `outreach_status='none'` is the truth |
| PayCaptain | Emailed | 24,920 | 24,784 | same intraday-freshness effect as Cylindo |
| all | Qualified/Total/Available (AP, Cyl) | — | — | unchanged where old columns hadn't drifted |

Freshness model (unchanged accuracy bar, "last 24h"): smartlead-perf back-sync
refreshes the ledger ~06:00–07:45 → snapshot runs 09:12 → app renders. Verified
sp_sync_runs #124 succeeded this morning (06:38→07:43).

## Upstream flags (not app work — for Omar)

1. **`omnivate_leads` has no `qualification_decision`** (has `qual_version`
   but not the verdict column) — the only standard ledger column missing
   anywhere. The app NULLs it via a data-driven probe; when the column lands,
   the app picks it up automatically, zero code changes.
2. **OrbitalX**: active + synced but has no `v_orbitalx_tam` /
   reachability views (only `v_orbitalx_actually_emailed`), so it can't join
   the ready bank yet. When the standard TAM views are created for it
   (migration-124 pattern), adding it = one slug in the roster array.
3. **`v_{slug}_contacts` exists only for cylindo** — the brief names it the
   canonical eligibility view but 4/5 clients don't have it, so the app reads
   the standard columns directly (same definitions, uniform everywhere).
4. **Cylindo enum stray**: 2 rows with `email_status='valid'` (not in the
   closed enum) — should surface via the daily audit; harmless here
   (`email_sendable=false` on both).

## Loom script (~4 min)

1. **Open the ClickUp task** — "the app must read the one consolidated
   schema so numbers mean the same thing for every client, and stop reading
   the columns being renamed `legacy_*`."
2. **Show the Ready Bank card (AP)** — walk the six numbers. "Every one of
   these now comes from the same two ledger columns on every client:
   can-we-email-them = `email_sendable`, have-we-touched-them =
   `outreach_status`."
3. **Split screen: Supabase SQL editor** — run the AP reconcile query (§3
   above), point at 7/7 exact matches with the card. Repeat for Cylindo.
4. **Show migration 025** — "one template, looped; the old version was four
   hand-written client arms reading a deprecated upload flag — one upstream
   rename away from silently freezing."
5. **Show the grep outputs** (§4/§5) — "no deprecated reads left; app writes
   nothing on lead tables — smartlead-perf and the LinkedIn engines own those
   columns."
6. **Close with the flags** — omnivate's missing qualification column,
   OrbitalX pending its TAM views, and PayCaptain's "Not tracked" now being a
   uniform <1%-judged rule instead of a hard-coded exception.
