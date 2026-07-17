# Omnivate Cockpit V2 — Manual QA Walkthrough (every little change)

**Site:** https://omnivate-cockpit.vercel.app
**Covers:** Phases 1–9 (V2). **Generated:** 2026-07-15.
**How to use this:** walk the site page by page in the order below. Each item is a *specific* change with **[Where]** (what to click), **[Was → Now]**, and **[Math]** where a number's formula changed. Tick the box once you've eyeballed it. A short "Verdict" box is at the very end.

> Tip on the range selector: the Command Center and each client's Overview have a **range control** (Today / 7 / 14 / 30 days, plus a custom picker on client pages). Almost every number is **range-scoped** now — if a number looks off, check which range is selected first. "Today" = the latest *business* day with data (weekends have no sends, so on a Mon it shows Friday).

---

## PART A — What you'll SEE change (page by page)

### 1. Sidebar / navigation
- [ ] **"Digest" is gone from the left sidebar.** [Was] a "Digest" item between Compare and Orders → [Now] removed. The digest content moved onto the Command Center (see §2).
- [ ] **Old `/digest` bookmark still works** — it now redirects to the Command Center home. [Where] type `…vercel.app/digest` → you land on Command Center.
- [ ] **Command palette** (Cmd/Ctrl-K) still finds it: search "digest" or "summary" → "Daily Summary" → opens home.
- [ ] Sidebar shows the **Omnivate mark + wordmark** at the top (Phase 1 shell).
- [ ] **Alerts badge number** next to "Alerts" is the *needs-action* count, not the raw pile. [Was] ~109 → [Now] ~28 (only actionable, un-acknowledged alerts). This should match the number of red/amber items you actually see on the Alerts page.

### 2. Command Center (home page `/`)
- [ ] **Range selector** top-right (Today / 7 / 14 / 30 Days). Click between them — the whole page repaints **instantly** (no multi-second freeze). This was 2.7–4.4s before Phase 4; now ~10ms to the button press.
- [ ] **"Positive Replies" KPI card** — [Was] labelled "Interested Replies" → [Now] "Positive Replies" with a small subtitle **"Interested + human-action-required"** (the confirmed definition).
- [ ] **KPI cards are range-scoped** and the "Emails Sent" / "Reply Rate" cards are labelled with the actual day when range = Today (e.g. "Emails Sent (Mon 14 Jul)") instead of a misleading "Yesterday".
- [ ] **Reply Rate KPI** is **total replies ÷ emails sent** for the selected range. [Was] all-time interested ÷ all-time sent (which read ~0.1% and was always red). [Math] see §B-1.
- [ ] On a **Sunday/Monday** the page is **not all zeros** anymore — it anchors to the last business day with data. [Math] §B-8.
- [ ] **Daily Summary section** (bottom of the page) — this is the merged digest:
  - [ ] A **"Copy to Clipboard"** button → copies a plain-text Slack summary (Emails Sent / Positive Replies / Total Replies / Reply Rate, then a per-client list, then deliverability + alerts). Paste it into Slack to check the format.
  - [ ] A **per-client breakdown table** (Client · Sent · Positive · Total Replies · Reply Rate). The column totals should reconcile with the KPI cards above (they read the *same* data now).
  - [ ] An explicit **"All clear"** green line appears when there are no deliverability issues and nothing needs action.
- [ ] **Client cards grid** — each card's reply-rate is range-scoped (total replies ÷ sends).
- [ ] **Sends vs Target on the cards shows the raw NUMBERS**, not just the % — the bar label reads e.g. "Sends vs Target · 1,410 / 1,500" with the "94%" on the right (post-launch tweak 2026-07-15). It grounds the percentage.
- [ ] **The red "Active Alerts" banner is GONE from the Command Center** (post-launch tweak 2026-07-15). Alerts live on the Alerts page + the sidebar badge now. The **Spam-risk banner** stays (only appears when recent spam tests failed).

### 3. Client page → **Overview** tab
Open any client (e.g. **Cylindo**, which has the richest data).
- [ ] **Top header line:** "**Sent (all-time)**" and "**Reply Rate (all-time)**" are explicitly labelled all-time (they were unlabelled). Reply rate = total replies ÷ sent (Cylindo ≈ **1.4%**, was ~0.1% because it used *interested* ÷ sent). Mailbox count shows "**(N sending)**" beside the total (e.g. "187 Mailboxes (65 sending)").
- [ ] **Range control** (This Week / This Month / All Time) + a **custom date picker** (from–to) — one selection drives the KPI cards AND all three charts below.
- [ ] **Two KPI rows:** a latest-day row (Emails Sent / Positive Replies / Total Replies / Reply Rate, each dated) and a range-scoped row that moves with the selector.
- [ ] **Chart 1 — "Sends vs Target"** — daily bars vs a target line. The target line **steps** with the per-weekday target (it's not a flat average); **red** bars = under that day's target, **grey** = weekend. Hover a bar → sent / target / shortfall. [Math] §B-3.
- [ ] **Chart 2 — "Reply Rate Trend"** (NEW) — a rate line with the **period average + its change vs the prior period** stated in the header (e.g. "+0.4pp vs prior"). Hover a day → sends / replies / rate. Days with no sends are bridged (not drawn as a fake 0%).
- [ ] **Chart 3 — "Positive Replies"** (NEW) — a count-only bar chart, subtitle "Interested + human-action-required".
- [ ] The **old three charts are gone** ("Sends — Last 7 Days", "Sends & Reply Rate — 14 Days", "Replies — 30 Days") — they told overlapping stories on three different hardcoded windows.
- [ ] **Ready Bank card** — the fuel-tank card (replaced the old lead-pipeline funnel). Check the lines:
  - [ ] Hero = **verified emails, never contacted and not in any campaign** (the conservative "available" number).
  - [ ] A line now reads "**Emailed**" (not "In campaigns"). [Was] the upload flag which overstated by 3.7k–6k per client → [Now] the live actually-emailed truth. [Math] §B-6.
  - [ ] "**Qualified**" shows a number for Cylindo/AP but "**Not tracked**" for PayCaptain and Omnivate (their tables have no real qualification verdict). It should *not* show a misleading near-zero.
  - [ ] A **3-segment bar** (emailed / amber "uploaded, never emailed" / green available) + an **ⓘ "What these numbers mean for this client"** expander with per-client definitions.
- [ ] **Provider Performance** card (sender + recipient inbox split) — unchanged in Phase 5+, verify it still renders.

### 4. Client page → **Positive Replies** tab (was "Interested Leads")
- [ ] **Tab renamed** "Interested Leads" → "**Positive Replies**".
- [ ] Count chip reads "**N positive replies**" with the definition "= Interested + human-action-required".
- [ ] Cylindo shows **~94 rows** (was ~38 — the old source undercounted by ~60%).
- [ ] Rows whose current category is human-action-required carry an amber "**action needed**" badge.
- [ ] **"Conversation" links work** — click one → it opens the correct Smartlead master-inbox thread for *that* lead. [Was] every link was dead (opened an empty inbox — the "Tyler Lopez" failure) because it used the lead id → [Now] uses the campaign↔lead map id. I re-tested 8/8 live today; they resolve. A lead with no captured map id simply shows no link (by design).
- [ ] Per-row "View" links: LinkedIn, company site, call-brief PDF (where present).

### 5. Client page → **Campaigns** tab
- [ ] **The "Type" dropdown is gone** — campaign class is now real **sections**:
  - [ ] "**Active Campaigns**" (green) = primary outbound only, with a "primary outbound" sublabel.
  - [ ] "**Follow-up Campaigns**" (sky) = reply-triggered subsequences, sublabel "low volume by design".
  - [ ] "**Referral Campaigns**" (violet).
  - [ ] "Past Campaigns" collapsible unchanged.
- [ ] Every "reply rate" here is relabelled "**Positive Reply Rate**".
- [ ] **Compare** button (needs ≥2 campaigns) → dialog. In the dialog:
  - [ ] Overlaid **Daily Sends** and **Positive Reply Rate** lines per campaign — **Daily Sends now shows real data** (post-launch fix 2026-07-15; see below).
  - [ ] A new **"Inbox Placement — latest test"** panel: one bar per campaign (inbox %, coloured by threshold, with the test date). [Was] a "view details" text note.
- [ ] **Expand a campaign card** (click a row) → the detail dropdown. The **"Daily Sends (14d)" bar chart now has data** — [Was] all-zero/empty bars because it reconstructed sends from the campaign *lifetime* total (which is flat every day, so every delta was 0) → [Now] it reads the view's real per-day `emails_sent` column (same fix applied to the Compare dialog). The "Positive Reply Rate % (14d)" line was already correct.

### 6. Client page → **Mailboxes** tab
This tab got the most work (Phase 7).
- [ ] **Capacity KPI cards** (Sending Capacity / Reserve Buffer / Needs Action) — "Sending Capacity" reads current **allowed/day** from the Smartlead-synced caps, and its gauge says "allowed/day". [Math] §B-5.
- [ ] **Daily Limit** figures come from the synced cap (`daily_send_limit`), not the drifting intent column. Active boxes should read 25 (Google) / 20 (Outlook); resting 5 / 4.
- [ ] **Lifecycle Distribution card** — the state legend (Active / Resting / Reserve / Warming / Parked / Burnt / Retired) is now **clickable**. Click **Active** (or any state with a count) → a **per-domain drill-down** appears: Domain · Boxes · Warmup (worst + median) · Tags · Age. Weakest domains sort first; a box below 97 shows red. [This is the drill-down you asked for.]
- [ ] **"Domain Health — weakest domain & at-risk (30 days)" chart** (redesigned):
  - [ ] It plots the **weakest domain** (red line, the min) + a p25/median band + an **at-risk-domain count** (amber bars, right axis), with the 97 burn line.
  - [ ] For a fully healthy pool (Omnivate / PayCaptain) it shows an explicit green "**All domains healthy**" banner instead of a meaningless flat line at 100.
  - [ ] [Was] a single averaged line that sat flat at ~100 forever and **hid dead boxes** (e.g. AP averaged 99.2 while one mailbox sat at warmup **0**). [Math] §B-4.
- [ ] **"Lifecycle & Health History"** — the old single mashed dual-axis chart is now **two separate charts**: (a) lifecycle mix over time (stacked areas), (b) average warmup % + at-risk count. The warmup average is **mailbox-weighted** now. [Math] §B-4.
- [ ] **"Retire Domain" button** (in the Action-Required domain group) — [Was] clicking it **errored** (hit a disabled backend) → [Now] it opens a dialog that says it *raises a proposal for approval* (it does NOT act immediately), then creates a decision in the **infrastructure decisions panel**. Nothing is cancelled/billed until that decision is approved and a supervised run executes it. **Safe to click to see the dialog + the raised proposal** (approving is the gated step).
- [ ] **Infrastructure decisions panel** — "Request order" and the retire proposals live here; approving marks the decision (never spends). A retire proposal shows "retire {domain} · N mailboxes".
- [ ] **Orders card** (InboxKit history + spend) — scope note present.

### 7. Client page → **Placement** tab
- [ ] A campaign with **only one placement test** now shows a **visible dot** labelled "(1 test)" in the legend, instead of the chart hiding until it had 2+ points.
- [ ] Errored / zero-seed test rows are dropped (they used to draw a fake dip to 0%).

### 8. Client page → **Alerts** tab  &  9. Global **Alerts** page (`/alerts`)
Both use the same table (Phase 8).
- [ ] **Severity colours are tier-aware** — **red is only** for genuinely critical, *actionable* items. A **maintenance** item (e.g. "warmup needs reconnect", of which there are ~49) is now **neutral grey even though its raw severity is "high"**. Nothing informational is red. There's a small **Legend** (Critical / Warning / Info / Maintenance) above the table.
- [ ] **"Ack" (Acknowledge) keeps the alert visible** — [Was] clicking Ack made the alert *vanish* (it silently resolved it) → [Now] the row goes **grey, stays in the list**, gets an "acknowledged Xm ago" stamp, and drops into a collapsed **"Acknowledged & maintenance (N)"** section below. It stops counting toward the badge/summary but is never deleted. **Try it on a test alert and confirm the row is still there, greyed.**
- [ ] **"Resolve"** still opens the notes dialog and keeps your note (unchanged), and moves the alert to "Recently Resolved".
- [ ] **Every alert row has a "View →" link** that routes to the right place: burn/warmup/drift/tag/blacklist → that client's **Mailboxes** tab; runway → **Ready Bank/Overview**; send-floor → **Overview**; placement → **Placement** tab.
- [ ] **Page layout:** a "needs action" list first, then the collapsed "Acknowledged & maintenance", then collapsed "Recently Resolved". The summary cards (Critical / Warning / Resolved This Week) stay at the top and now **exclude acknowledged** items from Critical/Warning.

### 10. Orders page (`/orders`)
- [ ] Scope note under the title: "**orders placed via this system (since Jun 2026)** … the original client pools predate order tracking". Spend counts completed orders only.

### 11. Audit Log (`/audit`)
- [ ] Rows with no client/domain (engine-level actions like daily-routine) render "**system**" / "**—**" instead of an empty clickable link.

### 12. Compare page (`/compare`)
- [ ] Client-level charts relabelled "**Positive Reply Rate**". (This page kept its 14-day charts — flagged as an optional future item.)

---

## PART B — The math (every formula that changed)

| # | Metric | Was (wrong/misleading) | Now (correct) | Why it matters |
|---|---|---|---|---|
| **B-1** | **Reply rate** (Command Center, client header, cards) | all-time **interested** ÷ all-time sent → read ~0.1%, permanently red | **total replies ÷ emails sent**, scoped to the selected range (client header keeps an all-time version, labelled) | The old numerator was positives, not replies — it made every client look dead. Cylindo went 0.1% → 1.4%. |
| **B-2** | **Positive replies** definition | ambiguous "Interested" only; source undercounted ~60% | **Interested + human-action-required**, current Smartlead category from `sp_campaign_leads` | Matches Smartlead's own UI; Cylindo 38 → 94. Shown with the definition in the UI. |
| **B-3** | **Sends vs Target** | daily_target **× calendar days** (compared 5 send-days against 7 days of target) | **Σ getTargetForDate(date)** over the fact dates in the range (respects the per-weekday target JSON; weekends = 0) | Stops the target being inflated by weekends. |
| **B-4** | **Pool / domain warmup** | (a) domain-health chart: **unweighted mean** across domains — a burnt box vanished into the average; (b) lifecycle history: **(a+b)/2** across child slugs (literally commented "weighted-enough" — it wasn't) | (a) chart now shows **min (weakest domain)** + at-risk count, not a mean; (b) **Σ(avgᵢ × mailbox_countᵢ) ÷ Σ mailbox_countᵢ** — a true mailbox-weighted grand mean | The old mean hid dead boxes (AP: 99.2 average with a mailbox at warmup 0). Weighting only bit multi-child parent clients. |
| **B-5** | **Sending capacity** | old intent column `max_email_per_day`, which the weekly rotation left **inverted** after every swap (active showed 5, resting showed 25–30) | reads the **Smartlead-synced `daily_send_limit`** (COALESCE fallback to the intent column) | Capacity views + the Daily Limit column now match reality. (Also fixed the rotation to keep the intent column truthful — see §C.) |
| **B-6** | **Ready Bank — "Emailed"** | `smartlead_uploaded` flag (upload-state, not contact-state) — overstated by AP +3,730 / Cylindo +6,084 / PayCaptain +3,835 / Omnivate +4,874 | the **live `v_{client}_actually_emailed` view** (Smartlead send-events ∪ repliers ∪ historical floor) | Uploaded ≠ emailed. The line is now the count we actually emailed. |
| **B-7** | **Ready Bank — "Available"** | verified emails not-uploaded | **verified AND never-emailed AND not-uploaded** (conservative); the "uploaded-but-never-emailed" cohort is shown separately (amber) | Stops queued/stale uploads inflating the "fuel tank". |
| **B-8** | **Date ranges** | `today − N calendar days` cutoff → matched **zero rows all Sun/Mon** (facts are weekday-only) | every range anchors to the **latest fact date** (`vw_cockpit_freshness`); "Today" = latest business day | The Command Center used to read all-zeros for ~48h every weekend. |
| **B-9** | **Ready Bank — "Qualified"** | fake **0** / a client-side 5% guess | real `qualification_decision='qualified'` count, or **NULL → "Not tracked"** when the client never ran qualification (PayCaptain 193/92,967; Omnivate has no column) | Honest "not tracked" instead of a misleading near-zero. |
| **B-10** | **Alert "needs attention" counts** (sidebar badge, summary cards, banner) | counted the **raw pile** (all open, both tiers) → ~109 | **actionable tier AND not acknowledged** only → ~28 | The badge now matches what actually needs a human. |

---

## PART C — Behind-the-scenes (changed the NUMBERS, not a single UI element)

These don't have one button to click, but they're why the numbers read correctly now. Verify by spot-checking the affected pages against Smartlead if you want.

- [ ] **Daily-facts backfill + trailing re-sync** (perf plugin): the sync used to write each day once, the morning after, and **skipped weekends entirely**. Now it re-pulls the last 5 calendar days every run (late replies/categorisations converge) and captures weekend dates. A one-off backfill converged **62 historical rows** and created **23 missing weekend rows** (e.g. AP's 67 weekend sends on 11–12 Jul now appear). Windows now match live Smartlead (Cylindo 7/14/30-day exact).
- [ ] **Conversation-link map-ids captured + backfilled** — the `campaign_lead_map_id` is now stored so conversation links resolve (the fix behind §A-4). Coverage 148/149 interested leads.
- [ ] **Rotation cap-column correction** (email-infra plugin): a one-off script fixed **300 of 303** A/B mailboxes whose `max_email_per_day` was inverted after swaps; the weekly rotation now maintains it on every swap.
- [ ] **DB migrations applied** (read-model views + snapshot functions): 017 (capacity/positive-replies views + config fix), 018 (Ready Bank truth), 019 (alert acknowledge columns). All live.
- [ ] **Config fix:** Acceleration Partners `is_active` was stale `false` in one config table (the app reads a different source, so no visible bug, but it's corrected).

**Two email-infra plugin PRs are open for Amzat to merge** (they carry the supervised executors + the rotation fix): `email-infra` **PR #1** (rotation cap column) and **PR #2** (retire-engine + order-engine manual-request). The cockpit already reads the corrected data regardless of merge.

---

## PART D — Deferred / known-minor (so nothing surprises you)

- [ ] **Retire-engine runs supervised** (by hand), not on the daily cron — because it cancels real InboxKit billing. Raising the proposal in the UI is safe; the destructive step is deliberately human-run. (Decision for Omar: cron vs supervised.)
- [ ] **A "Rotate" button on the Alerts tab code exists but is not mounted** (orphaned) — it points at a disabled endpoint but you can't reach it from the UI. Left for a cleanup.
- [ ] **No "un-acknowledge" button** yet — an acknowledged alert re-opens naturally on the next engine cycle if the condition is still true.
- [ ] **`/compare` page** kept its 14-day charts (only the campaign *compare dialog* got the Phase 5 treatment). Optional future unification.
- [ ] **OrbitalX** isn't in the daily perf sync (shows blank + fires a false "sent 0" alert) — an Omar decision to track or retire it.
- [ ] **The closing Loom** is the one V2 item only a person can produce (a 6-beat script is in `V2-PHASE9-ONE-HOME.md`).

## Open decisions collected for Omar
- OrbitalX: track or retire from the dashboard.
- Per-client send targets (PayCaptain 1,200-vs-3,000; Cylindo floor).
- Phase 5 chart choices (`V2-PHASE5-CHART-CHANGES.md`).
- Phase 6 gaps: run PayCaptain qualification? recycle the ~18.5k uploaded-never-emailed? (`V2-PHASE6-READY-BANK-GAPS.md`).
- Phase 7: retire-engine cron vs supervised; manual-order-on-full-bench behaviour (`V2-PHASE7-MAILBOX-ACTIONS.md`).

---

## Proof it reconciles
Every visible metric was checked against Supabase **and** Supabase against live Smartlead, for 7/14/30-day windows, on Acceleration Partners + Cylindo. Full record: `docs/V2-AUDIT-FINDINGS.md` (all reds closed). Today's re-checks: Cylindo windows exact 9/9 vs Smartlead; 8/8 conversation links resolve; prod test suite 36 passed.

---

## Your verdict (sign-off)
- [ ] Command Center + Daily Summary look right
- [ ] Client Overview charts + Ready Bank read correctly
- [ ] Campaigns sections + compare placement OK
- [ ] Mailboxes: domain-health chart, lifecycle split, drill-down, retire-proposal OK
- [ ] Positive Replies tab + conversation links work
- [ ] Alerts: acknowledge stays grey, red only for actionable, routing works
- [ ] Numbers match what you know from Smartlead

**If all ticked → V2 is good to close.** Remaining after close: merge the two email-infra PRs, Omar's open decisions, and record the Loom.
