-- cockpit_read_models_028 — V5: LinkedIn (Aimfox) outreach tables + verified seed
-- Applied live via Supabase Management API on 2026-07-21.
--
-- Discovery (V5 Phase 3): NO per-campaign LinkedIn outreach metrics are
-- persisted anywhere in the system today — Aimfox (per-workspace API) is the
-- only source, pulled ad-hoc. These two cockpit-owned tables give LinkedIn the
-- same shape email already has (registry + daily cumulative snapshots, mirroring
-- sp_campaigns + sp_daily_campaign_facts). Grain: aimfox_campaign_id × date,
-- CUMULATIVE counts (diff consecutive snapshots for per-day deltas once the
-- daily sync job lands — that job is a follow-up in the plugin/trigger stack;
-- the cockpit never calls external APIs live by design).
--
-- Seed: the verified all-client review of 2026-06-26
-- (omnivate-ai-outbound/docs/linkedin/2026-06-26-linkedin-campaign-review.md).
-- All campaigns have been PAUSED since that QA hold, so these numbers are
-- CURRENT reality, not stale data. Sent/accepted/messages = Aimfox
-- get_campaign_metrics (reliable); replies = raw Aimfox metric (undercounts —
-- the review's verified view: 4 real offer replies, 1 positive, omnivate);
-- positive_replies seeded from the verified view.

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  aimfox_campaign_id text PRIMARY KEY,
  client text NOT NULL,
  name text NOT NULL,
  persona text,
  targets_loaded integer,
  status text NOT NULL DEFAULT 'paused',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linkedin_daily_campaign_facts (
  aimfox_campaign_id text NOT NULL REFERENCES linkedin_campaigns(aimfox_campaign_id),
  snapshot_date date NOT NULL,
  connections_sent integer NOT NULL DEFAULT 0,
  connections_accepted integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  positive_replies integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual_snapshot',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aimfox_campaign_id, snapshot_date)
);

ALTER TABLE linkedin_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_daily_campaign_facts ENABLE ROW LEVEL SECURITY;

-- Registry seed (campaign IDs from the per-client campaign maps in
-- omnivate-ai-outbound clients/*/linkedin-connection-*.md; the omnivate SP2
-- UUID exists only as a prefix in docs — the sync job corrects it from the API)
INSERT INTO linkedin_campaigns (aimfox_campaign_id, client, name, persona, targets_loaded, status, notes) VALUES
  ('e4646b81', 'omnivate', 'Omnivate Lookalike List (SP2)', 'Agency lookalike offer', 200, 'paused', 'Docs carry the UUID prefix only — daily sync will store the full id'),
  ('15e65b4d-361d-4ff4-8762-8a8ca5f1d36e', 'cylindo', 'Jennifer Rasmussen', 'Senior C-Suite / founders', 200, 'paused', NULL),
  ('74d5b4f0-32d5-4016-b867-f14e7aaf350b', 'cylindo', 'Jostein Pedersen', 'Product / E-commerce', 200, 'paused', NULL),
  ('7bf68ad4-054e-43c3-b9af-afd0ba63f165', 'cylindo', 'Jack Crowe', 'Sales / commercial', 200, 'paused', NULL),
  ('444efb04-2865-4657-8990-e23d15b72a7a', 'cylindo', 'Blake Bergerson', 'Heads / Directors', 200, 'paused', NULL),
  ('3cbac81c-07f2-4fb6-86a7-b855a173c861', 'acceleration_partners', 'Tim Pike', 'Affiliate Managers', 383, 'paused', NULL),
  ('1e7c848f-d91c-4bb4-9a68-2b5f097db662', 'acceleration_partners', 'Badr Asad', 'Affiliate Managers', 387, 'paused', NULL),
  ('6bade6c9-044d-42bd-8576-1147707f2690', 'acceleration_partners', 'Jonathan Claydon', 'Senior Marketing Execs', 344, 'paused', NULL),
  ('305a6669-bb1b-4fa3-bfd8-8a5376e0c033', 'acceleration_partners', 'Terence Nelson', 'Senior Marketing Execs', 344, 'paused', NULL),
  ('f447411a-9b1b-4818-b896-1538fc14df08', 'paycaptain', 'Eve Kelly', 'Payroll buyers', 400, 'paused', NULL),
  ('f041f436-c47e-45d6-99fb-9f161625185f', 'paycaptain', 'Adam Groves', 'Payroll buyers', 400, 'paused', NULL)
ON CONFLICT (aimfox_campaign_id) DO NOTHING;

-- Facts seed — the 2026-06-26 verified snapshot (cumulative)
INSERT INTO linkedin_daily_campaign_facts
  (aimfox_campaign_id, snapshot_date, connections_sent, connections_accepted, messages_sent, replies, positive_replies, source) VALUES
  ('e4646b81',                             '2026-06-26', 199, 59, 34, 1, 1, 'review_2026-06-26'),
  ('15e65b4d-361d-4ff4-8762-8a8ca5f1d36e', '2026-06-26', 199, 52,  5, 1, 0, 'review_2026-06-26'),
  ('74d5b4f0-32d5-4016-b867-f14e7aaf350b', '2026-06-26', 199, 51,  3, 0, 0, 'review_2026-06-26'),
  ('7bf68ad4-054e-43c3-b9af-afd0ba63f165', '2026-06-26', 199, 37,  3, 1, 0, 'review_2026-06-26'),
  ('444efb04-2865-4657-8990-e23d15b72a7a', '2026-06-26', 192, 35,  5, 1, 0, 'review_2026-06-26'),
  ('3cbac81c-07f2-4fb6-86a7-b855a173c861', '2026-06-26',  69, 20,  4, 0, 0, 'review_2026-06-26'),
  ('1e7c848f-d91c-4bb4-9a68-2b5f097db662', '2026-06-26',  70, 14,  5, 0, 0, 'review_2026-06-26'),
  ('6bade6c9-044d-42bd-8576-1147707f2690', '2026-06-26',  72, 28,  9, 0, 0, 'review_2026-06-26'),
  ('305a6669-bb1b-4fa3-bfd8-8a5376e0c033', '2026-06-26',  72, 14,  2, 0, 0, 'review_2026-06-26'),
  ('f447411a-9b1b-4818-b896-1538fc14df08', '2026-06-26', 158, 28,  5, 0, 0, 'review_2026-06-26'),
  ('f041f436-c47e-45d6-99fb-9f161625185f', '2026-06-26', 174, 23,  6, 0, 0, 'review_2026-06-26')
ON CONFLICT (aimfox_campaign_id, snapshot_date) DO NOTHING;
