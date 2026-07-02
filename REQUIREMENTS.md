# Omnivate Deliverability Hub — Product Requirements & Build Spec

> **Status:** Draft v1 · **Owner:** Omar Almubarak · **Audience:** the engineer taking this app to "fully functioning"
> **Codebase:** `web/` (Next.js 16, App Router) on branch `main`
> **App package name:** `deliverability-dashboard` · **In-app brand:** "Deliverability Hub"

---

## How to read this document

This is a **brownfield spec**. The app already exists and most of the UI is built — this document captures the *intended behaviour* of every feature as formal requirements **and** marks how complete each one is, so it serves as both the specification and the backlog.

Every requirement is tagged with a **build status**:

| Tag | Meaning |
|---|---|
| ✅ **Built** | Implemented and believed working against current data. |
| 🟡 **Partial** | UI exists but needs wiring, data, or completion. |
| 🔴 **To build** | Not implemented / placeholder only. |
| ⚠️ **Broken** | Implemented but currently non-functional — almost always a **live Smartlead** dependency that must be re-pointed at Supabase. |

User stories are written as `As a <persona>, I want <capability> so that <outcome>`, followed by **Requirements** (what the system must do) and **Acceptance Criteria** (how we verify it). Source files are listed so the implementer can find the existing code fast.

**The single most important change** this document drives: the dashboard must read **all** performance/campaign data from **Supabase** (populated by our Smartlead Earth → Supabase pipeline), and **all direct live calls to the Smartlead API must be removed**. The detailed data/schema design for that pipeline is **out of scope here** (a separate data spec will follow); this document only states it as a binding constraint.

---

## Table of contents

1. [Overview & Purpose](#1-overview--purpose)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Personas & Primary Use Cases](#3-personas--primary-use-cases)
4. [Guiding Principles & Constraints](#4-guiding-principles--constraints)
5. [Information Architecture](#5-information-architecture)
6. [Functional Requirements](#6-functional-requirements)
   - [A. Authentication & Access](#a-authentication--access)
   - [B. Command Center](#b-command-center-global-overview)
   - [C. Client Detail](#c-client-detail-the-7-tabs)
   - [D. Cross-Client: Compare & Daily Digest](#d-cross-client-compare--daily-digest)
   - [E. Alerts & Anomaly Detection](#e-alerts--anomaly-detection)
   - [F. Audit Log](#f-audit-log)
   - [G. Infrastructure: Mailbox & Domain Lifecycle](#g-infrastructure-mailbox--domain-lifecycle)
   - [H. Client Onboarding](#h-client-onboarding)
   - [I. Settings](#i-settings)
   - [J. Intelligence Layer (Scoring)](#j-intelligence-layer-scoring)
   - [K. Platform Features](#k-platform-features)
7. [Data & Integrations (high-level)](#7-data--integrations-high-level)
8. [Known Gaps & Defects to Reach "Fully Functioning"](#8-known-gaps--defects-to-reach-fully-functioning)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Out of Scope / Future](#10-out-of-scope--future)
11. [Roadmap to Fully Functioning](#11-roadmap-to-fully-functioning)
12. [Appendix](#12-appendix)

---

## 1. Overview & Purpose

The **Deliverability Hub** is Omnivate's internal control tower for running AI-driven cold-outbound campaigns at scale across multiple B2B clients. It gives the ops team a single place to:

- See **how every client and campaign is performing** (emails sent, replies, positive/interested replies, reply rate, sending capacity).
- Monitor and protect **email deliverability** (mailbox health, warmup, inbox-placement testing, spam risk, burn prediction).
- **Manage email infrastructure** — the pool of sending domains and mailboxes — including ordering, warming, rotating, draining, retiring, and resting mailboxes.
- **Onboard new clients** end-to-end: search and order domains, provision mailboxes (via InboxKit), and hand off to Smartlead.
- **React to problems** through an alerting system with anomaly detection and a daily digest.

**Current state.** The app was built rapidly across several autonomous build runs (see [Appendix](#12-appendix) for the source PRDs). The result is a broad, largely complete UI with a real Supabase-backed query layer and Trigger.dev/InboxKit integrations. The known weak point is the **live data connection to Smartlead**: a small number of routes call the Smartlead REST API directly and are unreliable. The strategic fix is to make **Supabase the single source of truth**, fed by the separate Smartlead Earth → Supabase pipeline.

This document defines what "fully functioning" means so a single engineer can build on the existing code and close the gaps.

---

## 2. Goals & Non-Goals

### Goals
- **G1.** Every screen renders correct, current data sourced exclusively from Supabase.
- **G2.** Remove all direct/live Smartlead API calls from the web app.
- **G3.** Operators can monitor performance and deliverability for all active clients without leaving the app.
- **G4.** Operators can run the full mailbox lifecycle (order → warm → activate → rotate → drain → retire → rest) from the UI.
- **G5.** Operators can onboard a new client through the wizard with reliable, observable provisioning.
- **G6.** Alerts, anomalies, and the daily digest surface problems before clients notice them.
- **G7.** The app is reliable, responsive, and trustworthy (clear loading/empty/error states, data-freshness indicators).

### Non-Goals
- **NG1.** This is **not** a client-facing product — it is internal ops tooling. (Client-facing reporting lives elsewhere, e.g. the OrbitalX weekly sheet.)
- **NG2.** It does **not** author or send outbound copy — campaign creation/sending happens in Smartlead and the wider Omnivate pipeline.
- **NG3.** It does **not** replace the Smartlead Earth → Supabase ingestion pipeline — it consumes its output.
- **NG4.** Detailed data-pipeline/schema design is **deferred** to a separate spec.

---

## 3. Personas & Primary Use Cases

**P1 — Deliverability Operator (primary).** Runs daily ops across all clients. Lives in the Command Center, drills into clients, manages mailboxes, clears alerts, reads the digest.

**P2 — Client Lead / Account Owner.** Wants a fast read on a single client's performance and runway, and to spot risks early.

**P3 — Infrastructure Owner.** Onboards new clients, orders domains/mailboxes, manages the domain pool and capacity, and decides rotations.

### Primary use cases
- **UC1.** "How is everything doing today?" → Command Center + Daily Digest.
- **UC2.** "How is client X doing, and what's their runway?" → Client Detail → Overview.
- **UC3.** "Which campaigns are underperforming or at deliverability risk?" → Client Detail → Campaigns / Placement; Command Center spam banner.
- **UC4.** "A mailbox/domain is burning — rotate it." → Client Detail → Mailboxes; Alerts.
- **UC5.** "Onboard a new client and stand up their infrastructure." → Onboarding wizard.
- **UC6.** "What changed, and who did it?" → Audit Log.

---

## 4. Guiding Principles & Constraints

- **C1 — Supabase is the single source of truth.** All performance, campaign, mailbox, alert, and placement data is read from Supabase. The app must not depend on a live Smartlead connection at request time. *(Schema/pipeline detail deferred.)*
- **C2 — No live Smartlead calls in the web app.** The existing direct Smartlead REST calls (see [§8](#8-known-gaps--defects-to-reach-fully-functioning)) are removed and replaced by Supabase reads (for stats) and/or Trigger.dev tasks (for actions like pause/resume).
- **C3 — Actions go through Trigger.dev.** Mutations that touch external systems (mailbox rotation, ordering, provisioning, sync, pipeline runs) are dispatched to Trigger.dev tasks, never executed inline in a request handler.
- **C4 — Secrets stay server-side.** No API keys in query strings or client bundles. Server-only env: `SUPABASE_SERVICE_ROLE_KEY`, `TRIGGER_SECRET_KEY`, `INBOXKIT_API_KEY`. Browser-safe: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **C5 — Tech stack is fixed.** Next.js 16 (App Router, RSC), React 19, TypeScript, Tailwind 3 + shadcn/Radix, Recharts, `@supabase/ssr`, Trigger.dev, InboxKit. Playwright for E2E.
- **C6 — Multi-client aware, with parent/child clients.** Some clients are parents of regional children (e.g. `roosterpunk` → `roosterpunk_us` + `roosterpunk_uk`). Aggregations must roll children up under the parent everywhere.
- **C7 — Auth required.** All dashboard routes require an authenticated Supabase session.

---

## 5. Information Architecture

```
/login                          Auth (public)
/                               Command Center (global overview)
/clients/[slug]                 Client detail — tabbed:
      ?tab=overview                 KPIs, charts, anomalies, runway
      ?tab=campaigns                campaign performance + deliverability issues
      ?tab=pipelines                pipeline DAG, runs, prompt library
      ?tab=mailboxes                inventory, capacity, health, domain pool, ordering
      ?tab=placement                inbox-placement tests + trend
      ?tab=alerts                   client-scoped alerts
      ?tab=settings                 targets, thresholds, capacity
/compare                        Compare 2–3 clients side by side
/digest                         Daily digest (copy-to-clipboard)
/alerts                         Global alerts (filter, resolve, paginate)
/audit                          Audit log (filter, CSV export)
/settings                       App settings (burn threshold, appearance, account, system info)
/onboarding                     Onboarding list + new-client wizard
/onboarding/[id]                Setup detail + live provisioning timeline

# Consolidated redirect routes (intentional — not standalone pages):
/domains, /domains/[id], /accounts, /health   → client mailboxes tab or home
/analytics, /analytics/[client]                → home or client campaigns tab
```

**Navigation (sidebar):** Command Center · per-client list (color-dotted) · New Client · Compare · Digest · Alerts (with unresolved badge) · Audit Log · Settings · Sign out.

---

## 6. Functional Requirements

---

### A. Authentication & Access

#### AUTH-1 — Sign in ✅ Built
> As an operator, I want to sign in with email + password so that only authorized staff can access client data.

**Requirements**
- Email/password sign-in via Supabase Auth; cookie-based session via `@supabase/ssr` middleware.
- Failed auth shows an inline error; submit button shows a loading state.
- Successful sign-in redirects to `/`.
- Unauthenticated access to any `(dashboard)` route redirects to `/login`.
- Sign-out from the sidebar ends the session and returns to `/login`.

**Acceptance Criteria**
- [ ] Visiting any dashboard route while signed out lands on `/login`.
- [ ] Valid credentials redirect to Command Center; invalid show an error and do not navigate.
- [ ] Session persists across reloads; sign-out clears it.

**Source:** `app/(auth)/login/page.tsx`, `middleware.ts`, `lib/supabase/{client,server,middleware}.ts`

#### AUTH-2 — Account visibility & password management 🟡 Partial
> As an operator, I want to see which account I'm signed in as and change my password.

**Requirements**
- Settings → Account shows the signed-in email.
- Provide (or confirm) a working password-change flow.

**Acceptance Criteria**
- [ ] Account card shows the correct signed-in email.
- [ ] Password change succeeds end-to-end (or is explicitly documented as out of scope and removed from UI).

**Source:** `components/settings/account-card.tsx`

> **Note:** No sign-up, password reset, or MFA exists. Confirm whether any are required; default assumption is a small fixed set of internal users provisioned manually.

---

### B. Command Center (global overview)

#### CC-1 — Global KPI strip ✅ Built
> As an operator, I want top-line KPIs across all clients so that I get the state of the business in one glance.

**Requirements**
- KPI cards: **Emails Sent** (yesterday / selected range), **Interested Replies**, **Total Replies**, **Overall Reply Rate** (color-banded), **Active Alerts** (red if > 0), **Sending Capacity utilization %**.
- A **data-freshness badge** shows the latest snapshot date.
- All KPIs respect the time-range filter (CC-4).
- Data sourced from Supabase analytics snapshots (`getGlobalKPIs`).

**Acceptance Criteria**
- [ ] Each KPI shows a real value (not blank/0 when data exists).
- [ ] Reply rate is computed from all-time sent vs. interested and color-banded correctly.
- [ ] Freshness badge reflects the most recent snapshot date.

**Source:** `app/(dashboard)/page.tsx`, `components/shared/metric-card.tsx`, `components/shared/freshness-badge.tsx`, `lib/queries/analytics.ts:getGlobalKPIs`

#### CC-2 — Client summary grid ✅ Built
> As an operator, I want a card per client sorted by risk so that I know where to look first.

**Requirements**
- One card per active client: name, **health status badge**, latest metrics, alert count.
- Cards sorted by health priority (critical → warning → no-data → healthy), then alphabetical.
- Parent clients show **one combined card** rolling up children (C6).
- Card links to `/clients/{slug}`.

**Acceptance Criteria**
- [ ] Each active client appears exactly once (Roosterpunk shows one combined US+UK card).
- [ ] Sort order surfaces critical/warning clients first.
- [ ] Clicking a card opens that client's detail page.

**Source:** `components/dashboard/client-summary-grid.tsx`, `client-summary-card.tsx`, `lib/queries/analytics.ts:getClientSummaries`

#### CC-3 — Alerts & spam-risk banners ✅ Built
> As an operator, I want urgent issues promoted to the top so I can act immediately.

**Requirements**
- **Alerts banner** (renders only if alerts exist): top 5 alerts with severity, client, title; link to the client's alerts tab.
- **Spam-risk banner** (renders only if recent risky placements exist): campaigns with spam %, test date, red/amber badges; link to the client's placement tab.

**Acceptance Criteria**
- [ ] Banners are hidden when there is nothing to show.
- [ ] Each item links to the correct client + tab.

**Source:** `components/dashboard/alerts-banner.tsx`, `spam-risk-banner.tsx`, `lib/queries/analytics.ts:getTopAlerts`, `lib/queries/campaigns.ts:getRecentSpamRisks`

#### CC-4 — Time-range filter ✅ Built
> As an operator, I want to switch the window (1d/7d/14d/30d) so I can see short- and longer-term trends.

**Acceptance Criteria**
- [ ] Changing the range re-renders KPIs and the send-volume chart for that window; default is 7d.

**Source:** `components/dashboard/time-range-filter.tsx`

#### CC-5 — Daily send-volume chart ✅ Built
> As an operator, I want daily send volume vs. target so I can see if we're pacing correctly.

**Requirements**
- Line/area chart of sends per day across all clients for the selected range, with target overlay.
- Targets respect **per-day-of-week** targets and weekend exclusion (see J/anomaly rules).

**Acceptance Criteria**
- [ ] Chart shows one point per day in range with actual and target series.

**Source:** `components/dashboard/send-target-chart.tsx`, `lib/queries/analytics.ts:getDailySendHistory`

#### CC-6 — Sync status widget ✅ Built (verify against new pipeline)
> As an operator, I want to see when data last synced and trigger a manual sync.

**Requirements**
- Shows last-sync time; offers a "Sync Everything" action that dispatches the relevant Trigger.dev sync task(s).

**Acceptance Criteria**
- [ ] Last-sync time reflects the latest successful ingestion.
- [ ] Manual sync dispatches without blocking the page and surfaces success/failure.

> **Migration note:** "last sync" semantics must be re-pointed at the new Smartlead Earth → Supabase pipeline's freshness signal.

**Source:** `components/dashboard/sync-status-widget.tsx`, `lib/trigger-client.ts`

---

### C. Client Detail (the 7 tabs)

The client page resolves parent→child slugs, aggregates snapshots, shows a header + status, and renders 7 tabs persisted via `?tab=` URL param.

#### CD-0 — Client header & setup-gate ✅ Built
> As an operator, I want a consistent client header and, for clients still onboarding, a clear setup status instead of an empty dashboard.

**Requirements**
- If `client_setups.status !== 'completed'`: render a setup-status banner (draft / configuring / purchasing / provisioning / smartlead_pending / failed) with domain & mailbox counts and a link to `/onboarding/{id}` (or retry if failed).
- If completed: header with client name, status badge, slug, created/completed dates, pending-alert badge.

**Acceptance Criteria**
- [ ] Incomplete setups show the setup gate, not an empty data view.
- [ ] Completed clients show the header + tabs.

**Source:** `app/(dashboard)/clients/[slug]/page.tsx`, `components/clients/client-header.tsx`, `client-tabs.tsx`

#### CD-1 — Overview tab ✅ Built
> As a client lead, I want a client's headline performance, trends, pipeline funnel, and runway in one view.

**Requirements**
- **Anomaly callouts** from 14-day history (see J).
- **Performance metrics** with range toggles (7/14/30/60d).
- KPI cards: Emails Sent Yesterday, Interested Replies, Total Replies (all-time), Reply Rate (all-time), Mailbox Health %.
- **Mini send chart** (7d vs. daily target); **send + reply-rate** dual-axis chart (14d); **replies** chart (30d, positive replies + cumulative line).
- **Lead pipeline funnel** from latest snapshot; **runway & capacity** widget (estimated days to capacity exhaustion).
- **Recent alerts** (top 3 unresolved), link to alerts tab.

**Acceptance Criteria**
- [ ] For a client with data, "Emails Sent Yesterday" > 0 and all charts render.
- [ ] Parent clients aggregate children correctly (e.g. Roosterpunk combined sends).
- [ ] Runway widget shows a numeric estimate and a capacity gauge.

**Source:** `components/clients/tabs/overview-tab.tsx` + `mini-send-chart`, `send-reply-chart`, `replies-chart`, `lead-pipeline-funnel`, `runway-capacity-widget`, `anomaly-callouts`, `performance-metrics`

#### CD-2 — Campaigns tab ✅ Built / ⚠️ quick actions partly Smartlead-bound
> As an operator, I want per-campaign performance with drill-down so I can spot and fix weak campaigns.

**Requirements**
- **Campaign performance table:** name, type (primary/subsequence), health badge, sends, interested, total replies, reply rate, sparklines.
- Row drill-down → **campaign detail panel** (14-day history).
- **Deliverability issues** section: campaigns with low inbox placement (< 70%), color-coded.
- **Quick actions:** Pause / Resume / View in Smartlead, plus **compare-within-client** dialog and time-range + interested-leads counter.
- Campaign list resolves parent→child slugs (e.g. Roosterpunk shows all US+UK campaigns).

**Acceptance Criteria**
- [ ] Table is populated for clients with campaigns; parent clients show all child campaigns.
- [ ] Drill-down opens a detail panel with historical series.
- [ ] **Pause/Resume must operate via Trigger.dev (not a direct Smartlead call)** — see DEF-2.
- [ ] "View in Smartlead" opens the correct external campaign URL.

**Source:** `components/clients/tabs/campaigns-tab.tsx`, `components/campaigns/*`, `lib/queries/campaigns.ts`, `app/api/campaigns/[id]/status/route.ts` ⚠️, `app/api/campaigns/[id]/detail/route.ts`

#### CD-3 — Pipelines tab ✅ Built
> As an operator, I want to see each client's data pipelines, their latest run status, and trigger runs.

**Requirements**
- One card per pipeline definition: name, table, active/inactive, step count, latest run status + batch_id + progress (X/Y steps).
- **Run Pipeline** button (optional batch_id override) → Trigger.dev `run-pipeline`.
- Expandable **pipeline flow** (DAG with per-step run status), **prompt library viewer** (grouped by campaign), and **run history** (last 10).
- Empty state when no pipelines.

**Acceptance Criteria**
- [ ] Pipelines list renders from `pipeline_definitions`; runs from `pipeline_runs`.
- [ ] Run Pipeline dispatches a Trigger.dev run and reflects status.

**Source:** `components/clients/tabs/pipelines-tab.tsx`, `components/pipelines/*`, `lib/queries/pipelines.ts`

#### CD-4 — Mailboxes tab ✅ Built
> As an infrastructure owner, I want full visibility and control of a client's sending mailboxes and domains.

**Requirements**
- **Capacity KPI cards** (active sending capacity, warming/reserve, domain pool status).
- **Lifecycle breakdown** (active / warming / reserve / failed / rotating-out).
- **Master inbox card** (address, last sync, unread) when present.
- **Domain health trend** chart (30d) + **domain health heatmap** grid.
- **Capacity utilization gauge**.
- **Domain pool** section (candidates, search, personas) with **Order mailboxes** modal.
- **Mailbox inventory table:** email, domain, lifecycle, health, persona, sends/day, warmup %, reputation %, last activity, **per-mailbox spam rate & reply rate**; filter (domain/health/lifecycle), search, grouped by domain with domain-level actions; row expansion → **event timeline**; row actions (view, mark rotating, delete failed).
- Mailboxes grouped by health status with **collapsible** sections.

**Acceptance Criteria**
- [ ] Inventory loads with health/warmup/reputation values and supports search/filter/sort.
- [ ] Capacity cards + gauge reflect `v_client_capacity` / `v_client_health_summary` / `mailbox_clients` config.
- [ ] Domain actions and the order modal dispatch Trigger.dev tasks (see Section G).

**Source:** `components/clients/tabs/mailboxes-tab.tsx`, `components/mailboxes/*`, `lib/queries/mailboxes.ts`

#### CD-5 — Placement tab ✅ Built
> As an operator, I want inbox-placement test results and trend so I can catch spam-folder drift early.

**Requirements**
- **Inbox-placement trend** chart (30d, inbox %) with freshness badge.
- **Results table** (expandable): campaign, test date, inbox %, spam %, status badge; expansion shows per-provider breakdown (Gmail/Outlook/Yahoo/…), each with inbox/spam % color-coded.
- Empty state when no placement data.

**Acceptance Criteria**
- [ ] Table lists placement tests from `placement_test_results`; rows expand to provider breakdown.
- [ ] Trend chart shows inbox % over time.

**Source:** `components/clients/tabs/placement-tab.tsx`, `lib/queries/campaigns.ts:getClientPlacementResults`

#### CD-6 — Client Alerts tab ✅ Built
> As an operator, I want a client-scoped alert view so I can clear that client's issues in context.

**Requirements**
- Summary counts (critical / warning / resolved-this-week).
- Alerts table: unresolved first, then recently-resolved (collapsed). Resolve action with an "action taken" note. Empty state = "All Clear".

**Acceptance Criteria**
- [ ] Unresolved alerts list for the client; resolving sets status and records the note.

**Source:** `components/clients/tabs/alerts-tab.tsx`, `components/alerts/*`, `lib/queries/alerts.ts:getClientAlertData`

#### CD-7 — Client Settings tab ✅ Built
> As an operator, I want per-client targets and thresholds so KPIs and alerts judge each client correctly.

**Requirements**
- Display name; default daily email target; **per-day-of-week targets** (Mon–Sun); runway warning/critical day thresholds.
- Capacity overview (current estimated capacity, max day target, utilization %) with a warning if max day target > estimated capacity.
- Save → `PUT /api/clients/{slug}/settings`.

**Acceptance Criteria**
- [ ] Saving persists to `client_analytics_config` and is reflected in charts/anomaly targets.
- [ ] Over-capacity warning shows when configured target exceeds estimated capacity.

**Source:** `components/clients/tabs/settings-tab.tsx`, `app/api/clients/[slug]/settings/route.ts`

---

### D. Cross-Client: Compare & Daily Digest

#### CMP-1 — Compare clients ✅ Built
> As a client lead, I want to compare 2–3 clients side by side so I can benchmark performance.

**Requirements**
- Multi-select up to 3 active clients; charts render when ≥ 2 selected: send volume, reply rate, mailbox health (14d, multi-line). Empty state below 2.

**Acceptance Criteria**
- [ ] Selecting 2–3 clients renders all three multi-line charts; < 2 shows the prompt.

**Source:** `app/(dashboard)/compare/page.tsx`, `components/compare/*`, `lib/queries/analytics.ts:getClientComparisonData`

#### DIG-1 — Daily Digest ✅ Built
> As an operator, I want a copy-pasteable daily summary so I can post status to the team.

**Requirements**
- Header for the digest date; summary KPIs (sent yesterday, interested, total replies, overall reply rate); per-client breakdown table; deliverability-issues section (if any); active-alerts section (top 5).
- **Copy to clipboard** produces a clean plain-text version.

**Acceptance Criteria**
- [ ] Digest reflects yesterday's data per client; copy button yields readable plain text.

**Source:** `app/(dashboard)/digest/page.tsx`, `components/digest/digest-copy-button.tsx`, `lib/queries/analytics.ts:getDigestData`

---

### E. Alerts & Anomaly Detection

#### ALR-1 — Global alerts page ✅ Built
> As an operator, I want one place to triage all alerts with filters and resolution.

**Requirements**
- Summary cards (critical / warning / resolved-this-week).
- Filters: severity, client, alert type, status (unresolved/resolved). Pagination (25/page).
- Resolve via inline note → `PATCH /api/alerts/{id}/resolve` (sets `status='resolved'`, `resolved_at`). Acknowledge/dismiss → `PATCH /api/alerts/{id}/acknowledge` (sets `status='dismissed'`).

**Acceptance Criteria**
- [ ] Alerts list and filter correctly against `mailbox_alerts` using the **`status`** column (no `is_resolved`/`acknowledged_at` references remain).
- [ ] Resolve/dismiss persist and update the sidebar badge count.

**Source:** `app/(dashboard)/alerts/page.tsx`, `components/alerts/*`, `app/api/alerts/*`, `lib/queries/alerts.ts`

#### ALR-2 — Realtime alert notifications ✅ Built
> As an operator, I want to be notified the moment a new alert fires.

**Requirements**
- Supabase realtime subscription surfaces new alerts as toasts; notification-center panel lists recent notifications; sidebar shows unresolved count.

**Acceptance Criteria**
- [ ] Inserting a pending alert triggers a toast without reload and increments the badge.

**Source:** `components/layout/realtime-alerts.tsx`, `notification-center.tsx`, `app/api/alerts/recent/route.ts`

#### ALR-3 — Alert rules engine 🟡 Partial (verify against new data)
> As an operator, I want the system to automatically raise alerts for known failure modes.

**Requirements (rule set, from prior PRD work)**
- `STALE_CAMPAIGN` — no sends for 48h.
- `REPLY_RATE_CLIFF` — sudden reply-rate drop.
- Burn/health, low-reserve, declining-health, burnt-not-rotated (see J/burn-prediction).
- Rules run as a scheduled Trigger.dev task and write to `mailbox_alerts`; thresholds configurable.

**Acceptance Criteria**
- [ ] Each rule fires under its defined condition against Supabase data and writes a well-formed alert (type, severity, client, title, description, proposed_actions).
- [ ] Thresholds are configurable in Settings.

**Source:** `lib/scoring/*`, alert rule task(s) in `trigger/`, `app/api/analytics/*`

#### ALR-4 — Anomaly detection on client trends ✅ Built
> As a client lead, I want anomalies flagged on a client's trend so I notice problems without staring at charts.

**Requirements**
- Detect, from snapshot history: `SEND_DROP` (day-over-day > 30%, weekends excluded), `REPLY_RATE_DROP` (< 50% of 7-day moving avg), `SEND_BELOW_TARGET` (2+ consecutive days < 50% of day-specific target). Max 3 surfaced, sorted by severity.

**Acceptance Criteria**
- [ ] Overview tab shows anomaly callouts when conditions are met; none otherwise.

**Source:** `lib/scoring/anomaly-detection.ts`, `components/clients/anomaly-callouts.tsx`

---

### F. Audit Log

#### AUD-1 — Audit log with filters & export ✅ Built
> As an operator, I want a record of all infrastructure actions so I can trace what changed and when.

**Requirements**
- Table: timestamp, action, client, domain, status (success/failure/pending), description. Filters: action type, client, status, date range. Results counter. Pagination (25/page). **CSV export**.

**Acceptance Criteria**
- [ ] Log lists actions from `mailbox_actions_log`; filters narrow results; CSV downloads the filtered set.

**Source:** `app/(dashboard)/audit/page.tsx`, `components/audit/*`, `lib/queries.ts:getAuditLog`

---

### G. Infrastructure: Mailbox & Domain Lifecycle

> The mailbox lifecycle states are: `provisioning → warming → reserve → ramping → active → (burnt | draining | retired)`, plus `master`.

#### INF-1 — Mailbox inventory & per-mailbox metrics ✅ Built
> As an infrastructure owner, I want every mailbox's health and activity so I can manage the pool.

**Requirements**
- Inventory table (see CD-4) with health %, warmup %, reputation %, sends/day, spam rate, reply rate, lifecycle, persona, last activity; search/filter/sort; grouped by domain.

**Acceptance Criteria**
- [ ] Per-mailbox metrics render from `mailbox_accounts` + latest `mailbox_health_snapshots`.

**Source:** `lib/queries/mailboxes.ts`, `components/mailboxes/*`

#### INF-2 — Domain & mailbox lifecycle actions ✅ Built
> As an infrastructure owner, I want to rotate, drain, retire, and rest mailboxes/domains from the UI.

**Requirements**
- **Rotate** burnt domain → Trigger.dev `rotate-burnt-domain` (with preflight check).
- **Drain & swap** → Trigger.dev `drain-and-swap`.
- **Retire** with tag swap (one-click; polling + "retiring" state + auto-hide on completion).
- **Rest** action with explanatory tooltip; **Rotate/Drain** tooltips.
- Burn threshold from `app_settings` (default 97); domains 95–96.9% flagged "approaching burn".

**Acceptance Criteria**
- [ ] Each action dispatches its Trigger.dev task, shows progress, and writes to `mailbox_actions_log`.
- [ ] Retire flow polls to completion and updates lifecycle/tags without manual refresh.

**Source:** `app/api/domains/[id]/rotate`, `app/api/domains/drain`, `app/api/domains/[id]/preflight`, `app/api/mailboxes/[id]/{rest,timeline}`, `lib/scoring/burn-prediction.ts`

#### INF-3 — Capacity planning ✅ Built
> As an infrastructure owner, I want to see active vs. reserve capacity and how many mailboxes to order.

**Requirements**
- Capacity snapshot from `v_client_capacity`, `v_client_health_summary`, `mailbox_clients` config (min daily send volume, reserve target %, personas), burnt-awaiting-action, decisions, in-service `_active`-tag computation. Surface active/reserve gap and `mailboxes_to_order`, persona breakdown.

**Acceptance Criteria**
- [ ] Capacity cards/gauge and "mailboxes to order" reflect the views + client config.

**Source:** `lib/queries/mailboxes.ts:getClientCapacitySnapshot`

#### INF-4 — Order mailboxes ✅ Built
> As an infrastructure owner, I want to order new domains/mailboxes from the domain pool.

**Requirements**
- Order modal from the domain pool → `POST /api/clients/{slug}/order-mailboxes` → Trigger.dev `place-inboxkit-order-multi`. Order history at `/api/clients/{slug}/orders`; provisioning status polled per order.

**Acceptance Criteria**
- [ ] Placing an order dispatches the task and the order appears in history with a pollable status.

**Source:** `app/api/clients/[slug]/order-mailboxes`, `/orders`, `/orders/[id]/provisioning-status`, `components/mailboxes/order-mailboxes-modal.tsx`, `lib/inboxkit.ts`

---

### H. Client Onboarding

#### ONB-1 — Onboarding list ✅ Built
> As an infrastructure owner, I want to see all client setups and their status.

**Acceptance Criteria**
- [ ] `/onboarding` lists all `client_setups` with status and a link into each.

**Source:** `app/(dashboard)/onboarding/page.tsx`, `components/onboarding/onboarding-list.tsx`

#### ONB-2 — New-client wizard ✅ Built
> As an infrastructure owner, I want a guided wizard to stand up a new client's infrastructure.

**Requirements (5 steps)**
1. **Client info** — display name, auto-slug (with availability check), website.
2. **Domain selection** — search available domains (InboxKit), select, see per-domain + total cost, check InboxKit **wallet balance** (block Next if insufficient).
3. **Persona config** — add/remove personas (first/last name, photo URL; avatar upload).
4. **Review** — config + cost estimate → "Start Provisioning".
5. **Provisioning** — live progress; Google vs. Microsoft mailbox allocation breakdown.

**Acceptance Criteria**
- [ ] Slug availability is validated (`/api/onboarding/check-slug`).
- [ ] Domain search returns candidates; wallet balance gates ordering.
- [ ] Review triggers provisioning (`/api/onboarding/trigger-smartlead` → Trigger.dev `provision-client-setup`).

**Source:** `components/onboarding/wizard-shell.tsx`, `steps/*`, `app/api/onboarding/*`

#### ONB-3 — Setup detail & live provisioning timeline ✅ Built
> As an infrastructure owner, I want a live, step-by-step view of provisioning with retries.

**Requirements**
- Header (name, status badge, slug, dates); stats (domains, mailboxes, progress X/Y, estimated cost); InboxKit auto-reconnect reminder banner; **provisioning timeline** (realtime step statuses); **retry failed steps**; **Trigger Smartlead** when mailboxes provisioned + sequencer pending/failed; domain↔platform breakdown table; "View Client Dashboard" when completed.

**Acceptance Criteria**
- [ ] Timeline updates in realtime; failed steps can be retried; Smartlead handoff can be triggered when eligible.

**Source:** `app/(dashboard)/onboarding/[id]/{page,setup-detail-client}.tsx`, `app/api/onboarding/{retry-step,trigger-smartlead,get-setup,update-setup}`

#### ONB-4 — Campaign auto-discovery webhook ✅ Built (verify)
> As an operator, I want new Smartlead campaigns to register automatically.

**Requirements**
- `POST /api/webhooks/smartlead/campaign-created` validates and dispatches Trigger.dev `sync-campaign-registry`.

**Acceptance Criteria**
- [ ] A campaign-created webhook results in a `campaign_registry` row (via the task).

**Source:** `app/api/webhooks/smartlead/campaign-created/route.ts`

---

### I. Settings

#### SET-1 — App settings ✅ Built
> As an operator, I want global monitoring settings and system info.

**Requirements**
- **Burn threshold** card (default 97) → `app_settings`. **Appearance** (dark/light theme). **Account** (signed-in email; see AUTH-2). **System info** (total domains, total accounts, last sync, masked DB id, version).
- Per-client targets/thresholds live in the client Settings tab (CD-7), not here.

**Acceptance Criteria**
- [ ] Changing burn threshold persists and affects burn flagging.
- [ ] Theme toggle persists; system info shows correct totals + last sync.

**Source:** `app/(dashboard)/settings/page.tsx`, `components/settings/*`, `app/api/update-settings/route.ts`, `lib/queries.ts:getSettingsPageData`

---

### J. Intelligence Layer (Scoring)

Pure functions (no DB) consuming Supabase-derived inputs. Requirement: each must produce a deterministic score + status from documented inputs/weights.

#### SCO-1 — Campaign health ✅ Built
- Inputs: reply rate %, bounce ratio, emails sent, avg mailbox health.
- Weights: reply 35% · bounce 25% · send velocity 20% · mailbox health 20%.
- Output: 0–100, status healthy ≥70 / warning ≥40 / critical, with breakdown.
- **Source:** `lib/scoring/campaign-health.ts`

#### SCO-2 — Client health ✅ Built
- Inputs: avg mailbox health, send adherence, reply rate %, inbox placement %, pending alerts.
- Weights: 20% each. Status healthy ≥80 / warning ≥50 / critical.
- **Source:** `lib/scoring/client-health.ts`

#### SCO-3 — Spam risk ✅ Built
- Inputs: latest placement spam %, reply rate %, bounce ratio, all-time emails sent.
- Weights: placement 50% · reply 30% · bounce 20% (adaptive if no placement). Status danger >60 / warning ≥30 / safe.
- **Source:** `lib/scoring/spam-risk.ts`

#### SCO-4 — Burn prediction / rotation recommendations ✅ Built
- Detects approaching-burn (95–96.9%), declining-health (3+ down days), burnt-not-rotated (7+ days), low-reserve.
- **Source:** `lib/scoring/burn-prediction.ts`

**Acceptance Criteria (all SCO-*)**
- [ ] Each scorer is unit-testable and its output drives the corresponding badge/banner/recommendation.

---

### K. Platform Features

#### PLT-1 — Auto-refresh ✅ Built
> Configurable interval auto-refresh of dashboard data. **AC:** interval is configurable and refreshes data without a full reload. **Source:** `components/layout/auto-refresh.tsx`

#### PLT-2 — Command palette (Cmd/Ctrl+K) ✅ Built
> Keyboard-driven navigation/search. **AC:** opens with the shortcut and navigates to clients/pages. **Source:** `components/layout/command-palette.tsx`

#### PLT-3 — Data-freshness indicators ✅ Built
> "As of {date}" badges across views. **AC:** each data view shows the underlying snapshot date. **Source:** `components/shared/freshness-badge.tsx`

#### PLT-4 — Loading, empty & error states ✅ Built (audit for completeness)
> Skeletons on async sections, empty states, route error boundary. **AC:** every async section shows a skeleton while loading and an empty state when there's no data; the dashboard has a route-level error boundary. **Source:** `loading.tsx` files, `components/shared/empty-state.tsx`, `app/(dashboard)/error.tsx`

---

## 7. Data & Integrations (high-level)

> Detailed schema and the Smartlead Earth → Supabase pipeline design are **deferred to a separate data spec**. This section only records the integration surface so the implementer knows what to re-point.

**Supabase (source of truth — read).** Core infra: `mailbox_domains`, `mailbox_accounts`, `mailbox_health_snapshots`, `mailbox_actions_log`, `mailbox_alerts`, `mailbox_orders`, `mailbox_decisions`, `mailbox_domain_candidates`, `mailbox_clients`, `client_setups`, `setup_steps`. Analytics: `analytics_snapshots`, `campaign_analytics_snapshots`, `campaign_registry`, `client_analytics_config`, `placement_test_results`. Prompts/pipelines: `prompt_library`, `pipeline_definitions`, `pipeline_runs`, `v_campaign_prompt_registry`. Settings: `app_settings`. Views: `v_client_health_summary`, `v_client_capacity`, `v_burnt_domains_awaiting_action`.

> ⚠️ These names reflect what the app reads **today**. The new ingestion pipeline may expose its own tables/views; the data spec must reconcile these and any mapping happens behind `lib/queries/*`.

**Trigger.dev (actions — dispatch).** Whitelisted tasks: `refresh-client-analytics`, `sync-mailbox-inventory`, `sync-campaign-registry`, `monitor-mailbox-health`, `rotate-burnt-domain`, `drain-and-swap`, `run-pipeline`, `check-domain-candidates`, `place-inboxkit-order-multi`, plus `provision-client-setup`. Generic dispatch + polling via `/api/tasks/{trigger,status,recent-runs}`.

**InboxKit (provisioning).** Domain search, wallet balance, order placement, workspace/tag/catch-all/sequencer/profile-picture, export-to-Smartlead — via `lib/inboxkit.ts` (server-side, retrying fetch wrapper).

**Smartlead (TO BE REMOVED as a live dependency).** Currently two direct REST calls (campaign stats; campaign pause/resume) plus a possible master-inbox update. See [§8](#8-known-gaps--defects-to-reach-fully-functioning). Replace stats reads with Supabase; replace mutations with Trigger.dev tasks. Campaign-created webhook stays (it only dispatches a sync task).

---

## 8. Known Gaps & Defects to Reach "Fully Functioning"

| ID | Item | Type | Status | What "done" looks like |
|---|---|---|---|---|
| **DEF-1** | `/api/smartlead/campaign-stats` calls Smartlead REST directly with the API key in the query string. | Broken / security | ⚠️ | Campaign stats read from Supabase (`campaign_analytics_snapshots`); route removed or re-implemented as a Supabase read. No API key ever in a URL. |
| **DEF-2** | `/api/campaigns/[id]/status` (pause/resume) calls Smartlead REST directly with the API key in the query string. | Broken / security | ⚠️ | Pause/resume dispatched via a Trigger.dev task; UI reflects resulting status. No direct Smartlead call from the web app. |
| **DEF-3** | `/api/update-master-inbox` may write to Smartlead directly. | Suspect | 🟡 | Confirm; if it touches Smartlead live, move behind a Trigger.dev task or Supabase write. |
| **DEF-4** | Redirect-only routes (`/domains`, `/domains/[id]`, `/accounts`, `/health`, `/analytics`, `/analytics/[client]`). | Product decision | 🟡 | **Decision needed:** keep as intentional redirects into client tabs (recommended — matches current IA), or build standalone cross-client domain/account/health views. Documented here so it isn't mistaken for a bug. |
| **DEF-5** | Sync-status & "last sync" semantics assume the old refresh path. | Migration | 🟡 | Re-point freshness/last-sync to the new Smartlead Earth → Supabase pipeline signal (CC-6, SET-1). |
| **DEF-6** | Alert rules engine coverage vs. new data. | Verify | 🟡 | Confirm STALE_CAMPAIGN, REPLY_RATE_CLIFF, burn/health rules fire correctly against Supabase data and write well-formed alerts (ALR-3). |
| **DEF-7** | Password management / account flow. | Verify | 🟡 | Either make password change work end-to-end or remove it from the UI (AUTH-2). |
| **DEF-8** | E2E test suite freshness. | Test | 🟡 | Playwright suites pass against the Supabase-sourced app; one Command-Center full-flow test was previously failing — bring green. |
| **DEF-9** | Data correctness against the **new** pipeline tables. | Verify | 🟡 | Every screen shows correct values once reading from the new ingestion output (covered case-by-case by the data spec + each AC above). |

> **Historical note:** an earlier round of fixes (the "Dashboard V3" PRD) resolved a class of bugs — `is_resolved`→`status` column mismatch on alerts, parent/child client aggregation (Roosterpunk US+UK), and campaign-metric field selection. Those are believed fixed in the current code; re-verify after the data-source migration since they touch the same queries.

---

## 9. Non-Functional Requirements

- **NFR-1 Security.** No secrets in client bundles or URLs (C4). Service-role key server-only. Smartlead key not referenced by the web app after migration.
- **NFR-2 Auth.** All `(dashboard)` routes require a valid Supabase session (AUTH-1).
- **NFR-3 Performance.** Server-render with RSC; avoid N+1 query patterns in the snapshots/analytics routes; dashboards should be interactive within ~2s on a warm cache for a typical client set.
- **NFR-4 Responsive.** Usable at 375px (mobile), 768px (tablet), 1280px (desktop); sidebar collapses to a sheet on mobile.
- **NFR-5 Resilience.** Every async section has loading skeleton + empty state; dashboard route has an error boundary; external failures (Trigger/InboxKit) surface a clear message, never a blank screen.
- **NFR-6 Observability.** Actions write to `mailbox_actions_log`; data views show freshness; failed Trigger runs are visible.
- **NFR-7 Theming/Accessibility.** Dark/light themes; keyboard navigation (command palette); sensible color contrast and ARIA on interactive controls.
- **NFR-8 Data integrity.** Parent/child aggregation is consistent across Command Center, client detail, digest, and compare (C6).

---

## 10. Out of Scope / Future

- Detailed Smartlead Earth → Supabase pipeline & schema design (separate spec).
- Client-facing reporting/exports (handled outside this app).
- Authoring/sending outbound copy or sequences.
- Multi-tenant external access / role-based permissions beyond the internal team.
- Mobile-native app.

---

## 11. Roadmap to Fully Functioning

Phased so a single engineer has a clear execution order. Each phase ends with a verifiable checkpoint.

### Phase 0 — Data foundation (unblocks everything)
> *Depends on the separate data spec; do not start screen-level verification until this lands.*
- Point `lib/queries/*` at the Supabase tables/views populated by the new pipeline; reconcile any naming differences behind the query layer.
- **DEF-1 / DEF-2 / DEF-3:** remove all live Smartlead calls — campaign stats from Supabase, pause/resume + master-inbox via Trigger.dev tasks.
- **DEF-5:** re-point "last sync"/freshness to the new pipeline.
- **Checkpoint:** grep shows zero direct `server.smartlead.ai` calls and no Smartlead key usage in `web/`; Command Center + a sample client render correct numbers.

### Phase 1 — Correctness pass (make every screen true)
- Walk all ACs in [§6](#6-functional-requirements) against real data, screen by screen: Command Center → Client tabs → Compare/Digest → Alerts/Audit → Infra → Onboarding → Settings.
- **DEF-6:** verify the alert rules engine fires correctly and writes well-formed alerts.
- Re-verify parent/child aggregation (C6) and per-day targets/anomalies (CC-5, ALR-4).
- **Checkpoint:** every tab shows correct, fresh values for at least 2 clients incl. a parent client.

### Phase 2 — Decisions & loose ends
- **DEF-4:** decide redirect-routes vs. standalone views (recommend keep redirects).
- **DEF-7:** finish or remove password management.
- Confirm `client-actions-dropdown` / `status-chart` behaviours; remove any dead "coming soon" fallbacks.
- **Checkpoint:** no placeholder/"coming soon" states reachable in normal use.

### Phase 3 — Hardening
- **DEF-8:** Playwright E2E green (incl. Command-Center full flow).
- NFR pass: responsive (375/768/1280), performance (N+1 audit on snapshots route), error/empty states, accessibility.
- **Checkpoint:** CI green; manual smoke across breakpoints; ship.

---

## 12. Appendix

### A. Route inventory
**Pages:** `/login`; `/` (Command Center); `/clients/[slug]` (7 tabs); `/compare`; `/digest`; `/alerts`; `/audit`; `/settings`; `/onboarding`, `/onboarding/[id]`. **Redirects:** `/domains`, `/domains/[id]`, `/accounts`, `/health`, `/analytics`, `/analytics/[client]`.
**API routes:** `app/api/{alerts,analytics,campaigns,clients,domains,mailboxes,onboarding,smartlead,tasks,webhooks}/...`, plus `rotate-domain`, `update-master-inbox`, `update-settings`. (Full list in the codebase under `web/app/api/**/route.ts`.)

### B. Component inventory (by area)
`layout` (app-shell, header, sidebar, auto-refresh, command-palette, notification-center, realtime-alerts) · `dashboard` (time-range-filter, client-summary-grid/card, alerts-banner, spam-risk-banner, send-target-chart, sync-status-widget, status-chart) · `clients` (header, tabs + 7 tab components, mini/send-reply/replies charts, lead-pipeline-funnel, runway-capacity-widget, anomaly-callouts, performance-metrics, client-actions-dropdown) · `campaigns` (performance-table, detail-panel, health/spam badges, deliverability-issues, comparison-dialog, actions, mini-sparkline) · `mailboxes` (inventory-table, capacity cards/gauge, lifecycle-breakdown, master-inbox-card, health-chart/heatmap, domain-pool, mailbox-actions, burnt-domains-list, event-timeline, order/targets modals) · `pipelines` (flow, run-button, prompt-viewer, run-history) · `alerts` (table, filters) · `audit` (table, filters, csv-export) · `digest` (copy-button) · `compare` (selector, charts) · `onboarding` (wizard, list, shell, 5 steps, setup-detail-client) · `settings` (burn-threshold, appearance, account) · `shared` (metric-card, empty-state, freshness-badge, pagination) · `ui` (shadcn primitives).

### C. Scoring reference
See [§6.J](#j-intelligence-layer-scoring). Weights/thresholds defined in `lib/scoring/*`.

### D. Default client list
`roosterpunk, gladlane, orbitalx, valda, pantheon, omnivate, cylindo, paycaptain, acceleration_partners` (`lib/types.ts:DEFAULT_CLIENTS`). Active set comes from `client_setups` at runtime; parent/child config from `client_analytics_config.parent_client`.

### E. Glossary
- **Burn / burnt** — a mailbox/domain whose reputation has degraded below the burn threshold (default 97%).
- **Drain & swap** — gracefully wind down a domain's sending and substitute a fresh one.
- **Reserve** — warmed mailboxes held ready to activate; sized by `reserve_target_pct`.
- **Runway** — estimated days until a client exhausts sending capacity at current pace.
- **Placement test** — SmartDelivery-style inbox-vs-spam test, per provider.
- **Parent/child client** — a client split by region (e.g. `roosterpunk_us`/`roosterpunk_uk`) rolled up under a parent (`roosterpunk`).

### F. Source material consolidated into this doc
- Live code review of `web/` (pages, components, `lib/queries/*`, `lib/scoring/*`, API routes) — Jun 2026.
- Prior autonomous-build PRDs: **"Dashboard V3: Bug Fixes, UX Overhaul & Smart Features"** (50 stories, `scripts/ralph/prd.json`), **"Omnivate Dashboard Rebuild"** (45 stories), **"Campaign Intelligence Dashboard"** (15 stories). These remain useful as detailed implementation references but are superseded by this document as the single source of requirements.

> Two `ralph` rebuild worktrees exist (`.ralph-worktrees/dashboard-rebuild-v2`, `dashboard-v3-bugfix-ux`). Treat **`web/` on `main` as canonical**; mine the worktrees only for reference.
