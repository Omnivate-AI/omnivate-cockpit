# V3 Phase 3 — Client Overview restructure + graph reorder

**Status:** code complete · tsc clean · build green · **not yet pushed**
**Action points closed:** D1, D2, E1, E2, E3

---

## D1 + D2 — de-duplicated, re-ordered, re-labelled

The Overview had **two KPI rows**: an all-time/latest-day row (in `overview-tab.tsx`) *above* the range toggle bar, and a range-scoped row (in `overview-performance.tsx`) *below* it. Result: Positive Replies and Total Replies each appeared **twice**, the range **bar sat in the middle**, and one row said "all-time" while the other said nothing — and the latest-day positive (often 0) vs the range positive (e.g. 5) was the **contradiction** Omar saw.

**Fix:** removed the entire duplicate all-time row from `overview-tab.tsx`.
- One positive-replies card, one total-replies card — both range-scoped (D2).
- The range **bar now leads** the Overview (D2) — it's the first thing under the freshness line.
- Nothing is lost: the **sticky client header** already shows all-time Sent / Reply Rate / Mailboxes, and the bar's **"All Time"** preset reproduces the totals.
- **D1 gone:** there's now a single positive-replies number, driven by the one range selector.
- Added an always-on **"Showing {range}"** label under the bar so the window is never ambiguous (was "all time, all time … this one doesn't say all time").

## E1 — Positive Replies is the top graph, redesigned

Chart order was Sends → Reply-Rate → Positive. Now **Positive Replies is chart #1**, with **value labels above each bar** (zero days hidden) so the count reads at a glance, plus the period total in the header and weekend shading.

## E2 — Weekend shading

The series is now **filled to continuous calendar days** (facts skip inactive days, mostly weekends), so every weekend has a real column. A grey **`ReferenceArea` band** marks each weekend run on **all three charts**, so gaps read as "we don't send at weekends", not "missing data". *(This is the item most worth an eyeball on the live app — the band renders on a categorical axis.)*

## E3 — Reply-rate anomaly fixed + moved last

A weekend with ~0 sends but a stray response-agent reply produced a 30–60% "rate" that blew out the Y-axis. Now any day below a **20-send floor** (`MIN_SENDS_FOR_RATE`) has its rate **nulled and bridged** (`connectNulls`), so a stray reply can't spike the trend. The chart is also **moved to last** per Omar. Aggregate KPIs are unaffected (they sum real fact days, not the zero-fill).

## New chart order
1. **Positive Replies** (hero, value labels, weekend bands)
2. **Sends vs Target** (weekend bands + existing grey weekend bars)
3. **Reply Rate Trend** (last, anomaly-safe, weekend bands)

## Files
- `components/clients/tabs/overview-tab.tsx` — removed Row A + now-unused fetches/imports (`getClientTotalReplies`, `MetricCard`, `replyRateColor`, 4 icons).
- `components/clients/overview-performance.tsx` — `fillDaily` + `weekendSpans` helpers, continuous-day chartData, rate threshold, chart reorder, `ReferenceArea` weekend bands, `LabelList` value labels, always-on range label.

## Verification
- `npx tsc --noEmit` → clean · `npm run build` → compiled successfully.
- **Pending live review:** weekend band placement, value-label spacing, chart order — best confirmed on the deployed URL (the visual is the deliverable here).
