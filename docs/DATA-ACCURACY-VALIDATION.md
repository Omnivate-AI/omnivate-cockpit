# Omnivate Cockpit — Data-Accuracy Validation

**For:** Omar · **By:** Amzat · **Date:** 2026-07-08 · **App:** https://omnivate-cockpit.vercel.app
**Why:** Omar asked us to validate the numbers — "are we happy with the Ready Bank calculation and so on" — before moving forward.
**Method:** for each number the app shows, I recomputed it a *different* way from the base tables and compared, and I cross-checked one campaign against **live Smartlead**. Nothing here is "the app agrees with itself" — it's independent recomputation.

## Verdict up front
- **The calculations are correct — HIGH confidence.** Every independent recompute matched to the digit (details below).
- **The data is accurate as of the morning sync — by design.** It lags live Smartlead by that day's sends (the "Today, live" strip covers same-day). Not a bug; it's the "last 24 hours" bar we set.
- **The one real issue is labelling/semantics on the Ready Bank** — "Qualified" over-reads and "in a campaign" uses one of three disagreeing signals. Numbers are honest for "who can we reach"; the words need tightening. (This is the deferred clean-up.)
- **Recommendation: yes, we can move forward** — with the Ready Bank relabel done as the one cleanup, and two cross-source reconciliations noted below.

---

## 1. Calculation checks — app number vs independent recompute

| Surface | What the app shows | Independent recompute | Match? |
|---|---|---|---|
| **Ready Bank — verified emails (Cylindo)** | 39,409 (view) | 39,409 (base table, re-derived) | ✅ exact |
| **Ready Bank — available (Cylindo)** | 6,810 (view) | 6,810 (base table, re-derived) | ✅ exact |
| **Ready Bank — snapshot vs live (all clients)** | today's snapshot = live recompute | — | ✅ (07-08 snapshot current) |
| **Runway — Cylindo** | 0.22 days | 414 emails ÷ 1,900/day = 0.22 | ✅ exact |
| **Runway — AP** | 5.36 days | 8,036 ÷ 1,500 = 5.36 | ✅ exact |
| **Runway — PayCaptain** | 24.29 days | 37,770 ÷ 1,555 = 24.29 | ✅ exact |
| **Actionable alerts (per client)** | Cylindo 10 · AP 3 · PayCaptain 2 · Omnivate 0 | alerts view = portfolio roll-up | ✅ consistent |
| **Rotation capacity — Cylindo Group A** | 1,440/day | sum of caps from base = 1,440 | ✅ exact |
| **Rotation capacity — Cylindo reserves** | 48 boxes | base count = 48 | ✅ exact |
| **Send-floor logic** | PayCaptain alerted (1,555<3,000); AP silent (1,500=1,500) | yesterday's sends recomputed per client | ✅ correct |
| **7-day KPIs** | (Command Center) | base facts: 12,958 sent / 16 interested / 284 replies | ✅ data-layer consistent |

**Read:** the maths the app does is faithful to the data. No calculation errors found.

## 2. Freshness — the Smartlead cross-check

- Campaign "Cylindo Tech Report Furnishing": **Smartlead live = 19,157 sent**, **Supabase = 17,708**. Gap ≈ 1,449 = today's sends not yet pulled by the once-a-day sync.
- **This is the intended behaviour** (R1: the dashboard reflects Supabase, refreshed each morning; accurate to the last 24h). Same-day activity is shown separately by the "Today, live" strip, which reads the live send-events capture.
- **Confidence:** the daily numbers are correct as-of-sync; there's an expected intraday lag on lifetime totals. If Omar ever wants lifetime totals live-to-the-minute we'd revisit, but that wasn't the bar.

## 3. Ready Bank — the deeper look Omar asked for

The calculation is reproducible (§1), but two semantic things:

1. **"Qualified" over-reads.** The Ready Bank counts who's *reachable* (via `lead_status`), not who carries a `qualification_decision = 'qualified'`. For Cylindo, of ~91k in the reachable set only ~60.7k are actually stamped qualified and **~28k carry no qualification decision at all** — the Cylindo schema drift. → Relabel to "Total reachable (TAM)" + add a true "Qualified" line.
2. **"In a campaign" uses one of three disagreeing signals.** `smartlead_uploaded` (37,102) vs the canonical actually-emailed view (35,294) vs an older column (21,121). → Switch to the actually-emailed view for "contacted."

Both are cockpit-side, safe, and don't touch the databases Omar wants to revalidate. Deeper fix (the 28k no-decision Cylindo leads) = the schema revalidation Omar owns.

## 4. Cross-source findings (surfaced for the "validate the numbers" thread)

1. **Two "interested" sources disagree.** For Cylindo: the perf plugin's `sp_replies` says **28** interested; the lead table's `reply_category` says **36**. Two systems categorise (perf sync vs response agent). We should pick the authoritative one — recommend **`sp_replies`** (perf-fed, uniform across clients, the source Omar named) — and reconcile the 8-lead gap against the trackers.
2. **`reply_category` isn't a uniform column.** It exists on `cylindo_leads` but **not** on `paycaptain_leads` / `acceleration_partners_leads`. Another concrete example of the schema not being adhered to — and the reason the new interested-leads tab must be built off `sp_replies`, not the per-client reply columns.
3. **Interested → lead join gap.** For Cylindo, 24 of 28 interested replies match a lead by email; 4 don't. The new tab will join on email *and* Smartlead lead-id and still show the reply even when no lead matches, so nothing is dropped.

## 5. Interested-reply counts (context for the next build)
Live from `sp_replies` (category Interested): **Cylindo 28 · AP 19 · PayCaptain 12 · Omnivate 2 — 61 total (59 unique).**

---

## Recommended before "moving forward"
1. **Do the Ready Bank relabel** (Total reachable + true Qualified + actually-emailed for "contacted"). One small cockpit change; makes the headline honest.
2. **Confirm the authoritative "interested" source** = `sp_replies` (my recommendation) and note the 8-lead Cylindo gap for the schema revalidation.
3. **Then build the per-client Interested Leads tab** off `sp_replies` + lead-table join (decisions already locked: dedicated tab, include asset links, omit Intent).
4. **Bigger picture (Omar owns, not now):** the Cylindo lead schema revalidation — the 28k no-decision leads + the non-uniform `reply_category`.
