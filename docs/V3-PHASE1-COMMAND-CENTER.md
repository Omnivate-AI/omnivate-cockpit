# V3 Phase 1 — Command Center: "today", default view, send-target bugs

**Status:** code complete · production build green (`next build` exit 0) · **not yet pushed** (awaiting go)
**Action points closed:** A1, A2, A3, A4, A5

---

## A1 — "Today" was lying → relabel to "Yesterday"

The cockpit reads the last **complete business day** from the daily sync; there is no live-today view. The 1-day toggle was labelled "Today", making the headline numbers read as if live.

- `lib/range-utils.ts` — toggle label `"Today"` → `"Yesterday"`.
- `app/(dashboard)/page.tsx` — `RANGE_LABELS["1d"]` `"Today"` → `"Yesterday"`.
- The KPI cards already stamp the actual date (e.g. "Fri, 10 Jul") for the Mon/weekend case, so a Monday honestly reads Friday's date — kept.

## A5 — Default view = yesterday, not the 7-day roll-up

Every time you navigated back to the Command Center it reset to 7 days.

- `lib/range-utils.ts` — `DEFAULT_RANGE` `"7d"` → `"1d"`, and `parseRangeDays` fallback `?? 7` → `?? 1`.
- `app/(dashboard)/page.tsx` — `params.range ?? "7d"` → `?? "1d"`.
- Verified these are the **only** consumers (`range-transition.tsx` reads `DEFAULT_RANGE`, so clicking "Yesterday" also cleans the URL). Client pages use their own picker — untouched.

## A2 — Saved target didn't propagate

Updating a client's target in Settings didn't reflect on the Command Center. Two causes, both fixed:

1. **Stale cache** — the settings `PUT` never busted the cached RSC data.
   - `app/api/clients/[slug]/settings/route.ts` — added `revalidatePath("/")`, `revalidatePath("/clients/${slug}")`, `revalidatePath("/compare")` after a successful write.
   - `components/clients/tabs/settings-tab.tsx` — `router.refresh()` after save so the change shows immediately.
2. **Wrong field** (Omnivate case) — see A3. Omar edited `daily_email_target` but the display reads `daily_targets`.

## A3 — Two target fields had drifted (the core bug)

Settings prominently edits `daily_email_target` (single number) but every chart/bar reads `daily_targets` (per-weekday JSON). They diverge on save. Live state at review:

| Client | Settings field | Weekday JSON (what showed) |
|---|---|---|
| PayCaptain | 1,200 | **3,000** |
| Omnivate | 1,200 | **500** |
| AP | 1,000 | 1,500 |
| Cylindo | 1,000 | null (→ uses 1,000) |

**Decision (Omar/Amzat, 2026-07-20): single number is master.**

- **Data normalised** — for the 3 drifted clients, `daily_targets` weekdays set to `daily_email_target`, weekends 0. Effective now: **AP 1,000 · Omnivate 1,200 · PayCaptain 1,200**. (Cylindo left null — already master-driven and validated by Omar.) SQL run against `client_analytics_config`.
- **Mechanism** — `settings-tab.tsx`: the single field ("Daily Email Target" → relabelled **"Weekday Send Target"**) now **cascades** to Mon–Fri on change (weekends 0); the per-day grid remains for overrides. Editing the master resets per-day overrides (noted in the helper text). So what you set is always what shows.

## A4 — Send-vs-target window defined + labelled

The window is the **selected range, weekday-scoped**: target = sum of the client's weekday targets over the days in range (weekends contribute 0), vs actual sends over the same days.

- The client per-day chart (`overview-performance.tsx`) was already weekday-aware (per-day target line, weekends greyed) — confirmed correct, no change.
- Added a window tooltip to the Command Center card (`components/dashboard/client-summary-card.tsx`) so the aggregate "1,410 / 1,500" is understood as working-days-in-range, not padded by weekends.
- Because the default view is now a single complete day (A5), "below target" is unambiguous on open.

---

## Verification
- `npx tsc --noEmit` → clean.
- `npm run build` → exit 0, all routes compiled.
- Live visual walkthrough (Yesterday default + a Settings save reflecting immediately) to be captured on the deployed URL at review.

## Not done here (moved to later phases)
- The client Overview's own layout/labels around Sends-vs-Target get their final pass in **Phase 3** (overview restructure), where weekend shading (E2) also builds on the per-day chart's existing weekend greying.
