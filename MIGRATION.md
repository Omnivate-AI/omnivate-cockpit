# sp_* Data-Layer Migration — 2026-07-02

The app (`web/` from omnivate-ai-outbound, brand "Deliverability Hub") repurposed
onto the shared **sp_*** Supabase data layer that the smartlead-perf and
email-infra plugins maintain. Functionality preserved; data source replaced;
live Smartlead calls removed. Per Omar's directive (ClickUp 869dpbgff,
2026-07-02): *"keep the current functionality of the app and make sure it's
pulling from the right data."*

## Architecture rule (unchanged from the PRD)

- The app reads **sp_\* only**, through the `vw_cockpit_*` read-model views.
  It NEVER calls Smartlead/InboxKit live.
- The two plugins remain the only data/control plane.
- Additive DB changes only — nothing the plugins read/write was altered
  (two additive columns: `sp_infra_alerts.resolution_note`,
  `client_analytics_config.daily_targets`).

## Read-model views (migrations `cockpit_read_models_001/002` — applied live)

| View | Replaces | Source |
|---|---|---|
| vw_cockpit_accounts | mailbox_accounts | vw_sp_mailboxes (provider-normalized) + roster campaign_ids |
| vw_cockpit_domains | mailbox_domains | sp_domains + live account counts |
| vw_cockpit_alerts | mailbox_alerts (reads) | sp_infra_alerts + domain name (writes go to sp_infra_alerts) |
| vw_cockpit_actions | mailbox_actions_log | sp_actions_log + domain/mailbox attribution |
| vw_cockpit_daily_client_perf | analytics_snapshots (daily) | sp_daily_campaign_facts × sp_campaigns × sp_clients |
| vw_cockpit_client_lifetime | analytics_snapshots (all-time) | sp_campaign_lifetime rollup |
| vw_cockpit_campaigns | campaign_registry | sp_campaigns + lifetime |
| vw_cockpit_campaign_daily | campaign_analytics_snapshots | sp_daily_campaign_facts (keyed by SMARTLEAD id) |
| vw_cockpit_placement_results | placement_test_results | sp_inbox_placement_tests/_results (per-provider jsonb) |
| vw_cockpit_client_health_summary | v_client_health_summary | vw_sp_mailboxes lifecycle counts |
| vw_cockpit_client_capacity | v_client_capacity | sum(max_email_per_day) by lifecycle |
| vw_cockpit_domain_health_daily | mailbox_health_snapshots (domain) | sp_daily_mailbox_facts warmup avg |
| vw_cockpit_mailbox_rates | mailbox_health_snapshots (account) | latest placement spam % + 30d reply rate |
| vw_cockpit_burnt_domains | v_burnt_domains_awaiting_action | sp_domains lifecycle='burnt' |
| vw_cockpit_client_daily_facts | — (new) | sp_daily_client_facts (plugin runway/capacity) |
| vw_cockpit_freshness | app_settings.last_sync | sp_sync_runs + facts + events max dates |

Client registry: **sp_clients.active** drives the switcher (4 active today:
acceleration_partners, cylindo, omnivate, paycaptain). `client_analytics_config`
stays as the APP-OWNED targets/hierarchy table (daily targets, runway
thresholds, parent/child) — config, not pipeline data.

## Defects fixed en route (from web/REQUIREMENTS.md §8)

- **DEF-1** `/api/smartlead/campaign-stats` — now reads sp_* (same response shape); no API key in URLs.
- **DEF-2** campaign pause/resume — disabled behind `FLAGS.campaignActions` (410) until a Trigger.dev primitive exists.
- **DEF-3** `/api/update-master-inbox` — disabled (was writing legacy tables + possibly Smartlead).
- **DEF-5** last-sync/freshness — re-pointed to `sp_sync_runs` (`vw_cockpit_freshness`; `/api/tasks/recent-runs` now reports real sync runs).
- **AUTH gate (AUTH-1/NFR-2)** — middleware claimed auth but had NO redirect ("all routes are public"). Every route except `/login` now requires a session.
- `client_analytics_config.daily_targets` column was missing entirely (code selected it → PostgREST 400). Added.
- Alert severity vocabulary — infra alerts use high/medium/low (not critical/warning); color maps, filters, counters and the realtime toast gate now handle both vocabularies (was crashing the client Overview tab).
- Dashboard pages were prerendered at build time (baked stale data, required DB during builds). Now `force-dynamic`.

## Disabled in this build (see `lib/flags.ts`)

| Feature | Why | Comes back |
|---|---|---|
| Onboarding wizard (+ nav entry) | writes client_setups/setup_steps; provisioning is owned by the email-infra + client-onboarding plugins | TBD (may stay plugin-owned) |
| Infra actions: rotate / drain / rest / order / master change | their Trigger.dev tasks operate on the retired mailbox_* model | Build 5 via sp_*-native primitives (e.g. the email-infra-slack-approve edge fn) |
| Campaign pause/resume | was a live Smartlead call | Build 5 |
| "Sync Everything" / analytics refresh | legacy refresh task wrote retired tables | PORT-1 (kick the perf-plugin sync) |
| Trigger.dev whitelist | trimmed to `run-pipeline` only | grows with Build 5 |

Disabled API routes return **410** with a clear message; buttons that call them
fail clean with a toast.

## Verified against live data (2026-07-02)

- Command Center KPIs reconcile EXACTLY to SQL over the same window
  (7d: 6,525 sent / 8 interested / 104 replies).
- Cylindo header: 68.8k lifetime sent / 0.1% interested rate / 185 mailboxes —
  matches sp_campaign_lifetime + sp_mailboxes exactly.
- Auth gate: unauthenticated → /login; login → Command Center.
- Freshness: "1 day ago" (facts through 2026-07-01; sync 07:43 this morning).
- `npx tsc --noEmit` clean; `next build` green.

## Run it

```bash
npm install
cp .env.example .env.local   # fill 3 vars (see below)
npm run dev
```

| Env var | Purpose |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | https://uivgowblojtyiobhgjlv.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | browser: login + realtime only |
| SUPABASE_SERVICE_ROLE_KEY | server-only: all data reads |
| TRIGGER_SECRET_KEY (optional) | pipeline run button only |

## Vercel

Import the repo at vercel.com/new → framework auto-detects Next.js → paste the
4 env vars → deploy. Every push to main auto-deploys.

## Known gaps for the iteration loop (post-review)

- Lead-bank metrics (ready leads, qualified-no-email, pipeline runway) aren't
  tracked in sp_* → cards show 0 / 999-day placeholders. Decide: hide the tiles
  or add a source.
- `sp_mailbox_daily` (per-mailbox health snapshots) still has no writer —
  health trends currently derive from sp_daily_mailbox_facts warmup values.
- Reply provider segmentation (sp_replies.recipient_provider) and orders/spend
  (sp_orders) are in the data layer but under-surfaced in the UI — quick wins.
- e2e/ suites still seed legacy tables (DEF-8) — rewrite against sp_* later.
- `hooks/use-setup-realtime.ts` is dead code while onboarding is disabled.
