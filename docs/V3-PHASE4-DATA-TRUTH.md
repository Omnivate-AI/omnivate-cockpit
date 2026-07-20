# V3 Phase 4 — Provider Performance + Ready Bank data truth

**Status:** E4 + F1 + F2 + F3 code complete · DB fixes applied + verified · build green · **not yet pushed**
**F4 diagnosed + deferred** (needs a semantic call from Omar — see below)

---

## E4 — Provider "Other" was the recipient split, not SMTP

AP's mailboxes are cleanly **150 Google / 50 Microsoft — zero "other" on the sender side**. The "6,131 from other" Omar saw is the **recipient-inbox** panel (where prospects receive mail, MX-classified), where "Other" = self-hosted / non-Google-or-Microsoft domains. That's legitimate, but the panel read like it implied SMTP *sending*.

**Fix (`provider-split-card.tsx`):** the recipient panel now says **"By recipient inbox provider"** with a one-liner — *"Where the people we email receive mail (their MX) — not how we send. 'Other' = self-hosted or non-Google/Microsoft domains."* — and "Other" is relabelled **"Other domains"** in that panel. No SMTP sending is implied anywhere (we send only from Google + Microsoft).

## F2 — LinkedIn-only was massively under-counted (the headline data bug)

The snapshot filtered `linkedin_reachable AND NOT email_reachable`. When `email_reachable` is **NULL** (a lead with no verified email), `NOT NULL = NULL`, and Postgres drops NULL from a `FILTER` — so every "on LinkedIn, no email" lead vanished. Cylindo's view returned strict booleans so it worked; the others didn't.

**Fix:** `COALESCE(email_reachable,false)` (+ `COALESCE(linkedin_reachable,false)`). Verified after re-running the snapshot:

| Client | LinkedIn-only before | after |
|---|---|---|
| AP | 10 | **32,353** |
| Omnivate | 0 | **148,010** |
| PayCaptain | 131 | **36,371** |
| Cylindo | 13,256 | 13,256 (already correct) |

## F1 + F3 — lead with Qualified, then Qualified + verified email

Omar: *"start with qualified … then the ones that have verified emails from our qualified term."* The snapshot had `qualified` and `email_verified` as **separate** columns with **no intersection**, and the card led with "Total reachable".

**Fix:**
- New column **`qualified_email_verified`** on `cockpit_ready_bank_daily` = `qualified AND email-verified` (NULL for untracked clients). Verified: **AP 30,878 · Cylindo 15,059**; NULL for omnivate/paycaptain.
- `ReadyBankCard` reordered to lead with **Qualified → Qualified + verified email → Total reachable → Verified email → LinkedIn-only → Emailed**.
- `ReadyBankRow` type + both query paths updated (NULL-aware aggregation for parent groups).

## F4 — "Converted" date is the ingestion time, not the real conversion  *(diagnosed, deferred)*

The Interested-Leads tab's **"Converted"** column reads `cockpit_interested_leads.date_converted`. Every client's **most-recent** value is clustered at ~2026-07-17 06:5x (all four within ~10 min) — i.e. the **batch sync timestamp**, not when the lead actually converted. So recent rows show when we *captured* them, not when they converted.

**Decision (Omar, 2026-07-20): split into TWO columns** — "Became interested" **and** "Meeting booked".
- **Became interested** — the date the reply was categorised Interested; sourced from the reply / `LEAD_CATEGORY_UPDATED` event (in Supabase). Fixable: correct `cockpit_interested_leads` population to stamp the event time, not the sync time.
- **Meeting booked** — lives in the **SDR trackers, not Supabase**. Needs a data source (tracker import / a booked field) before it can be populated; until then the column renders "—" and the gap is surfaced.

**Deferred to a focused follow-up** (not in this phase): touches the `cockpit_interested_leads` population job + the interested-leads tab columns, and the "meeting booked" half needs a trackers source wired in.

## Files / DB
- DB migration `db/migrations/cockpit_read_models_021.sql` — add `qualified_email_verified`, rewrite `fn_cockpit_snapshot_ready_bank` (COALESCE linkedin_only + intersection), applied live + snapshot re-run.
- `lib/queries/ready-bank.ts`, `components/clients/ready-bank-card.tsx`, `components/clients/provider-split-card.tsx`.

## Verification
- Corrected filters validated by SQL **before** applying; snapshot re-run and re-queried — all four clients correct.
- `npx tsc --noEmit` clean · `npm run build` compiled successfully.
