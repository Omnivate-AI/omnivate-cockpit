# Omnivate Cockpit — V4 Iteration Plan

**Prepared by:** Amzat · **For:** Omar's review · **Date:** 2026-07-21
**Scope:** the fourth iteration, built from your V3 video review (2026-07-20) + your follow-up ClickUp comment (the two reply-rate graphs + the provider matrix)
**Live app:** https://omnivate-cockpit.vercel.app · **Repo:** `Omnivate-AI/omnivate-cockpit`

This captures every action point from the video, turns them into requirements with acceptance criteria, and groups them into build phases. Structure mirrors the V2/V3 plans so it reviews the same way. Target: updated by EOD per your comment.

> **Sources:** (1) your video walkthrough of V3, transcribed and cross-checked; (2) your ClickUp follow-up comment adding the two provider reply-rate graphs and the 3×3 matrix. 14 action points across 5 surfaces.

---

## Your review in one paragraph

V3 landed the right headline metric — now you want it **everywhere and differentiated**. Two distinct efficiency ratios: **contacts per positive reply** (how many *people* per win) and **emails per positive reply** (how many *sends* per win — 10 emails to one person who replies = 10:1 emails, 1:1 contacts). You want both as cards at the **client level**, both at the **campaign level**, and both as **compare parameters**. Campaign cards get re-led: **positive replies count is the #1 figure**, then sends, then the two ratios — the positive-reply-rate % comes off the top spot. The **provider reply-rate split** is telling you something real (Microsoft ≈ nothing, Google getting through) — you asked to confirm what it measures and its window, and followed up asking for it as proper graphs: a **recipient-side reply-rate line chart** (aggregate / Microsoft / Google / Other), a **sender-side equivalent**, and a **3×3 sender×recipient matrix**. The **pipeline section** needs cards that **collapse/expand** and a **true flow visualization** (steps run in parallel, not just one long sequential card). And **Compare** becomes a **parameter picker**: choose clients, choose metrics, compare.

---

## Answers to the questions you asked in the video

- **"Is this aggregated reply rate for the people we're outreaching to?"** — Yes. The provider split you were reading is **recipient-side**: replies ÷ sends *into* Google / Microsoft / Other inboxes, classified by the recipient domain's live MX records. Your Microsoft observation is real and now measurable per client (that's exactly what Phase 3's graphs make first-class).
- **"What range is this — this week? last week?"** — It was a fixed trailing window ending at the latest synced day, and the label didn't say so. In V4 every provider surface states its window explicitly and follows the page's range selector where one exists.
- **"Contacts per positive reply — is this aggregated across everyone?"** — Yes, the Command Center card is all-clients. V4 adds the per-client and per-campaign versions.
- One honesty flag: V3 originally built **both** ratio cards on the Command Center; I removed "Emails per Positive Reply" during the iteration as near-redundant with reply rate. Your video makes the distinction explicit — it's restored in Phase 1 and extended everywhere alongside contacts-per-positive-reply.

---

## The plan at a glance

| Phase | What | Action points | Status |
|---|---|---|---|
| 1 | Both conversion ratios as cards: Command Center (restore emails/PR) + client level | A1–A3 | ✅ Shipped 2026-07-21 |
| 2 | Campaign cards re-led: positive replies #1 · sent · both ratios (PRR% off the top spot) | B1–B4 | ✅ Shipped 2026-07-21 |
| 3 | Provider truth: recipient + sender reply-rate line graphs · 3×3 matrix · explicit windows | C1–C4 | ✅ Shipped 2026-07-21 |
| 4 | Pipelines: collapsible cards + true DAG flow visualization | D1–D2 | ✅ Shipped 2026-07-21 |
| 5 | Compare: parameter picker (clients × metrics) | E1 | ✅ Shipped 2026-07-21 |
| 6 | QA vs prod + deploy + walkthrough | — | ✅ Suite green (37 passed) · deployed · proofs in `docs/V4-BUILD-NOTES.md` |

---

# Action points → requirements

## A — The two conversion ratios (differentiated, everywhere)

> *"If I am emailing you 10 times and then you reply — emails per positive reply is 10 to 1, but contacts per positive reply is 1 to 1. I want to be able to differentiate between these."*

- **A1 · Two metrics, both defined and shown.** **Contacts per Positive Reply** = distinct people emailed ÷ positive replies. **Emails per Positive Reply** = emails sent ÷ positive replies. "Positive reply" stays the confirmed definition (Interested + human-action-required). Distinct contacts come from the send-events capture (`COUNT(DISTINCT lead)`), same as V3 Phase 2.
- **A2 · Command Center cards.** Both ratios as top-level cards, range-scoped. (Contacts/PR already exists; Emails/PR is restored.) Both restored in the Daily Summary per-client table + the copy-to-Slack text.
- **A3 · Client-level cards.** Both ratios as cards at the top of every client's Overview, driven by the same range selector as the other KPIs (presets + custom dates). "—" when there are no positive replies in range.

**Done when:** both cards render on the Command Center and on every client Overview, respond to the range selector, and reconcile to a hand recomputation for AP + Cylindo.

## B — Campaign level re-led

> *"I'm not really interested in this positive reply rate percentage… What I want to know is how many interested replies did we get — I want that to be the number one figure. Then the number sent. And then the two ratios."*

- **B1 · Positive replies count is the #1 figure** on every campaign card.
- **B2 · Emails sent** is the second figure.
- **B3 · Both ratios per campaign** — contacts/PR and emails/PR computed per campaign (per-campaign distinct contacts from send events).
- **B4 · Positive-reply-rate % comes off the top spot.** It remains available in the detail panel and as a Compare parameter — it's just no longer the headline.
- Applies to **all campaign sections** — Active, Follow-up, Referral, and Past.

**Done when:** every campaign card leads with positive replies, then sent, then the two ratios; spot-checked against Smartlead for 3 campaigns.

## C — Provider performance, first-class

> *"We are sending primarily to Microsoft and we're not going through, but for Google we have a much higher reply rate."* + follow-up comment.

- **C1 · Semantics + window labeled.** Every provider surface says whether it's recipient-side or sender-side and states its date window explicitly (no more guessing "this week? last week?").
- **C2 · Recipient-side reply-rate line graph.** One line chart, per client: **4 lines — Aggregate, Google, Microsoft, Other/SMTP** — reply rate into each recipient provider over time (replies from that provider ÷ sends to it, per day). Low-send days are rate-nulled and bridged (same anomaly guard as the V3 reply-rate chart) and weekends shaded.
- **C3 · Sender-side reply-rate line graph.** The same chart keyed by the **mailbox provider that sent** (our Google pool vs our Microsoft pool vs SMTP/Other).
- **C4 · 3×3 provider matrix.** Sender provider (rows: Google / Microsoft / Other) × recipient provider (columns: Google / Microsoft / Other): each cell shows **reply rate + sends** for the selected range — e.g. "our Google boxes into Microsoft inboxes". Powered by a small pre-aggregated daily table (sender×recipient×client×day) filled from the send-events capture and reply records by the same self-healing daily job pattern that fills the recipient split — never a live scan per page view. Matrix data exists from **3 Jun 2026** (when send-event capture began); the card says so.

**Done when:** all three visuals render on the client Overview (and the graphs aggregate on the Command Center), every one labeled with side + window; matrix cells reconcile to SQL ground truth for AP + Cylindo on a spot-check.

## D — Pipelines: collapse + true flow

> *"Right now this is just one big card… it would be nice if we can toggle this open or close. And are we able to visualize this flow? Sometimes things happen in parallel."*

- **D1 · Collapsible pipeline cards.** Each pipeline campaign card toggles open/closed; **collapsed by default** with a one-line summary (name, client, status, step count), active pipelines expanded first in the list.
- **D2 · True DAG visualization.** The step list becomes a flow: steps with the same dependency level render **side-by-side as a parallel band**; dependent steps flow below their prerequisites. Built from the pipeline engine's real dependency data (`dependencies` / `depends_on_step` / `step_order`), so the picture is the true shape of the build, not an invented sequence. Conditional steps and inactive steps are visually distinct.

**Done when:** the pipeline list opens compact; expanding a card shows the flow with parallel steps visibly parallel; the Cylindo Stage 2 Personalization pipeline renders its actual shape.

## E — Compare: parameter picker

> *"The parameters that we have on these different tabs, I want to be able to compare… interested replies, reply rate, emails per positive reply, contacts per positive reply, volume, positive reply rate percentage."*

- **E1 · Pick clients × pick parameters.** The Compare surface lets you multi-select clients and multi-select parameters from: **Positive replies · Reply rate · Emails per positive reply · Contacts per positive reply · Volume (emails sent) · Positive reply rate %** — rendered side-by-side per parameter for the selected range.

**Done when:** any combination of the 6 parameters across any set of active clients renders a readable comparison, range-scoped, numbers matching the same metric elsewhere in the app.

---

## Judgment calls I'm making in-build (flag now, review live)

1. **Where the provider graphs live:** client Overview (per-client diagnosis is where you were reading them) + an all-clients aggregate on the Command Center. The 3×3 matrix goes on the client Overview.
2. **Matrix cell content:** reply rate as the headline of each cell with sends underneath — rate alone hides volume, volume alone hides efficiency.
3. **PRR% survives** in campaign detail panels and Compare — removed only as the card's top figure.
4. **Pipeline default state:** ALL cards open collapsed (your words — "so we don't have these massive cards"), with active pipelines listed first; one click expands any card.
5. **Ratios' precision:** shown as whole numbers when ≥10 (e.g. "1,084"), one decimal below 10 (e.g. "6.3") — matches how you'd say them aloud.

---

## Working method

Same as V2/V3: phase docs in `docs/V4-PHASE{N}-*.md` with reconciliation proof · build → tsc/build/e2e green → deploy → prod screenshots · one ClickUp update with the walkthrough when it's live.
