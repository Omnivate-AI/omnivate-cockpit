# V3 Phase 2 — Two headline conversion metrics

**Status:** code complete · build green · RPC live + verified · **not yet pushed**
**Action points closed:** B1 (top cards), C1 (daily summary)

---

## What was built

Two efficiency metrics, across all clients, range-scoped:
- **Emails per Positive Reply** = emails sent ÷ positive replies
- **Contacts per Positive Reply** = distinct people emailed ÷ positive replies

They differ once we send >1 email per person (follow-ups). Real 7-day gap confirms the metric is meaningful: Cylindo 1.53 emails/contact, AP ~1.0.

"Positive reply" = the confirmed definition (Interested + human_action_required), reused from the existing `positive_replies_count`.

## The data piece — distinct contacts (new)

Emails + positives already existed. **Distinct contacts emailed** did not, and couldn't be a summed daily view (a lead emailed on Mon + Wed would count twice — the exact emails-vs-people gap the metric measures). So:

- **New RPC** `cockpit_contacts_emailed(p_start date, p_end date)` — `COUNT(DISTINCT smartlead_lead_id)` over `sp_send_events`, joined to `sp_clients`, bounded in UTC to match the facts' `snapshot_date`. Migration `db/migrations/cockpit_read_models_020.sql`, applied live.
- Bounded to the **same `[cutoff, anchor]` business-day window** the emails/positives KPIs use, so numerator and denominator align.
- Source is the webhook capture (`sp_send_events`), live since ~2026-06-03 — covers every range the UI offers.

## Surfaces

- **Command Center** (`app/(dashboard)/page.tsx`) — a new efficiency row under the 4 primary KPIs: "Emails per Positive Reply" + "Contacts per Positive Reply", both range-scoped, showing "—" when there are no positives yet.
- **Daily Summary** (`components/dashboard/daily-summary.tsx`) — two new per-client columns ("Emails / Pos", "Contacts / Pos"); the copy-to-Slack text (`lib/digest-text.ts`) gains the two global figures in its SUMMARY block.
- **Query layer** (`lib/queries/analytics.ts`) — `getContactsEmailed(days)` (cached RPC call) + `periodContacts` added to every `ClientSummary`.

## Representative numbers (7-day, all clients)

Emails 26,009 · Positives 24 · Contacts 20,986 → **≈1,084 emails / positive · ≈874 contacts / positive.**

Per client (7d): Cylindo 658/431 · Omnivate 672/596 · AP 1,164/1,037 · PayCaptain 8,264/7,053 (only 1 positive in the window — ratio is real, just early).

## Verification
- `npx tsc --noEmit` → clean (also confirms `buildDigestSummaryText` has a single caller).
- `npm run build` → compiled successfully.
- RPC tested via **SQL** and via the **live PostgREST endpoint** (the exact `supabase.rpc()` path the app uses) — schema cache is fresh, returns correct distinct-contacts per client.
- Live card render to be shown on the deployed URL at review.
