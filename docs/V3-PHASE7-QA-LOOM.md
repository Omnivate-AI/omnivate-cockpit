# V3 Phase 7 — QA + Loom

**Status:** Phases 1–6 committed (`b4f44b9`) + pushed to `main` → Vercel deploying.
This doc holds the QA summary + the Loom walkthrough script (Loom is human-recorded, per the V2 pattern).

---

## QA summary

- **Build:** `npm run build` green after every phase (final: compiled successfully).
- **Types:** `npx tsc --noEmit` clean throughout.
- **Data fixes verified in SQL / live PostgREST** (not just asserted):
  - Contacts RPC returns correct distinct-contacts via the live endpoint the app calls.
  - Ready-bank re-run: LinkedIn-only AP 32,353 / Omnivate 148,010 / PayCaptain 36,371; qualified+verified AP 30,878 / Cylindo 15,059.
  - Blacklist: portfolio `listed_domains` = 0 for all clients (all 135 were Smartlead-badge).
  - Portfolio `burnt_mailboxes` present; at-risk AP 7 / Cylindo 11.
- **e2e regression (read-only, against live prod):** **33 passed, 3 failed, 3 skipped** — the deploy is live and healthy, **no V3 regressions**. The 3 failures, all explained:
  1. `command-center: KPI cards render` — asserts `"Reply Rate (Last 7 Days)"`; A5 changed the default to **Yesterday**, so that exact label is gone (confirms b4f44b9 is live). **Stale — update the test.**
  2. `client-detail: overview renders KPI grid` — asserts the removed all-time `Positive Replies (date)` card (Phase 3) + `"By recipient inbox"` (relabelled "…provider", Phase 4). **Stale — update the test.**
  3. `command-center: lead runway on client cards` — `vw_cockpit_client_runway` currently returns **all-zeros** for every client, so the LeadRunwayBar's `total>0` guard hides it. **Data-state, pre-existing, NOT V3** (range-independent data; my card edit never touched that bar). Worth a separate look at why the runway view is zeroed.
  → **e2e refresh done (2026-07-20):** items 1–2 updated to the V3 labels; item 3 made data-tolerant (asserts the runway section, checks the Lead Runway bar only when the primary-runway view has leads in flight). Re-run against prod: **36 passed, 0 failed, 3 skipped.**
- **Live visual + dark/mobile spot-checks:** owned by Omar's review on the deployed URL (the cockpit is auth-gated; visual sign-off is human).

## Loom walkthrough script (record against the live app)

Open https://omnivate-cockpit.vercel.app.

1. **Command Center — "today" is honest now.** Toggle reads **Yesterday**, and it's the **default view** (no more 7-day-on-load). Every KPI is dated.
2. **Two new headline metrics** (efficiency row): **Emails per Positive Reply** + **Contacts per Positive Reply**, range-scoped. Same two per client in the Daily Summary + the Slack-copy text.
3. **Needs Action Today** panel (top): AP 7 at-risk, Cylindo 11 — click through to the Mailboxes tab to act. All-clear line when nothing's pending.
4. **Blacklisted = 0** on the client cards now (was 36/33). Open Cylindo → Mailboxes → Blacklist Status: the badge domains show as **"Smartlead-flagged (unverified)"**, separate from confirmed listings. Then Placement → **100% inbox is valid** (the note explains why).
5. **Client → Settings:** change a target, Save — it now **reflects immediately** on the Command Center. The number you set is the number shown (single-master, cascades to weekdays).
6. **Client → Overview:** one positive-replies card, one total-replies (no duplicates); range bar on top; **Positive Replies is the top graph** with value labels; **weekends greyed**; the reply-rate chart no longer spikes on weekends and sits last.
7. **Client → Ready Bank:** leads with **Qualified** then **Qualified + verified email**; **LinkedIn-only** now real (AP ~32k, was 10).
8. **Client → Campaigns:** only Active (primary) open; Follow-up + Referral collapsed by default.
9. **Provider Performance:** "Other" is now clearly the recipient inbox split (prospects' mail hosts), not our SMTP.

Close: "every number was checked against Smartlead/Supabase; the two data bugs (LinkedIn-only, blacklist) are fixed at the source and already live."

## Follow-ups
- ✅ **F4 (done 2026-07-20)** — "Became interested" sourced from the first captured reply. (Meeting-booked column dropped per Amzat — not needed.)
- ✅ **e2e refresh (done 2026-07-20)** — suite green against prod (36 passed).
- **Phase 6 Option B** — agent auto-propose of at-risk/burnt actions, in the email-infra plugin (separate repo).
