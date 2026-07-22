-- cockpit_read_models_029 — V5.1: sp_ prefix for the LinkedIn tables
-- Applied live via Supabase Management API on 2026-07-22.
--
-- The Aimfox daily sync will run as a step inside the smartlead-perf plugin's
-- daily routine (Amzat's call, 2026-07-22), so the tables join the sp_* family
-- that plugin owns. Renamed one day after creation — the cockpit was the only
-- reader, so no other consumer existed yet.

ALTER TABLE linkedin_campaigns RENAME TO sp_linkedin_campaigns;
ALTER TABLE linkedin_daily_campaign_facts RENAME TO sp_linkedin_daily_campaign_facts;
