-- =============================================================
-- cockpit_read_models_015 - materialize interested leads (perf).
-- =============================================================
-- Even after the 014 rewrite the view is 6-8s/client (lower(email) join
-- seq-scans the 90k-260k lead tables) — poor UX + near the API timeout.
-- Same fix as ready_bank / send_floor / mailbox_daily: compute once in a
-- daily background job, tab reads a tiny table instantly. Daily cadence
-- matches the app's "accurate to last 24h" bar and the perf plugin's own
-- daily run. Function runs in a DB session (no PostgREST timeout).
-- Rollback:
--   SELECT cron.unschedule('cockpit-interested-leads-daily');
--   DROP FUNCTION IF EXISTS public.fn_cockpit_snapshot_interested_leads();
--   DROP TABLE IF EXISTS public.cockpit_interested_leads;
-- =============================================================

CREATE TABLE IF NOT EXISTS public.cockpit_interested_leads (
  client               TEXT NOT NULL,
  date_converted       TIMESTAMPTZ,
  replier_email        TEXT NOT NULL,
  smartlead_lead_id    TEXT,
  full_name            TEXT,
  company_name         TEXT,
  title                TEXT,
  phone                TEXT,
  linkedin_url         TEXT,
  company_linkedin_url TEXT,
  website              TEXT,
  industry             TEXT,
  call_brief_pdf_url   TEXT,
  sendspark_video_url  TEXT,
  snapshot_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cockpit_interested_leads_client ON public.cockpit_interested_leads(client);
ALTER TABLE public.cockpit_interested_leads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fn_cockpit_snapshot_interested_leads()
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  TRUNCATE public.cockpit_interested_leads;
  INSERT INTO public.cockpit_interested_leads
    (client, date_converted, replier_email, smartlead_lead_id, full_name,
     company_name, title, phone, linkedin_url, company_linkedin_url, website,
     industry, call_brief_pdf_url, sendspark_video_url, snapshot_at)
  SELECT client, date_converted, replier_email, smartlead_lead_id, full_name,
     company_name, title, phone, linkedin_url, company_linkedin_url, website,
     industry, call_brief_pdf_url, sendspark_video_url, now()
  FROM public.vw_cockpit_interested_leads;
END;
$fn$;

-- Daily at 09:14 UTC (after ready-bank 09:12, before runway 09:20)
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cockpit-interested-leads-daily') THEN
    PERFORM cron.schedule(
      'cockpit-interested-leads-daily',
      '14 9 * * *',
      'SELECT public.fn_cockpit_snapshot_interested_leads()'
    );
  END IF;
END;
$do$;
