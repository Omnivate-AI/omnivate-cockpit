-- =============================================================
-- cockpit_read_models_018 — Ready Bank truth, client by client (V2 Phase 6)
-- =============================================================
-- Reconciled 2026-07-14 against the canonical qualification rules
-- (omnivate-ai-outbound/knowledge/system-rules/lead-table-qualification-schema.md):
--
-- 1. "In campaign" switches from smartlead_uploaded to the CANONICAL
--    contacted-state truth: v_{slug}_actually_emailed (live view over
--    sp_send_events ∪ sp_replies ∪ the per-client historical floor).
--    The uploaded flag is upload-state, not contacted-state, and it
--    overstates reality on every client (reconciliation, TAM-scoped):
--      acceleration_partners  uploaded 27,411  vs emailed 23,681  (+3,730)
--      paycaptain             uploaded 28,985  vs emailed 25,150  (+3,835)
--      cylindo                uploaded 26,204  vs emailed 20,120  (+6,084)
--      omnivate               uploaded  5,901  vs emailed  1,027  (+4,874)
--    The line is relabeled "Emailed" in the UI.
--
-- 2. "Available" becomes conservative: verified email AND never emailed
--    AND not uploaded anywhere. The uploaded-but-never-emailed cohort
--    (queued or dead uploads — the deltas above) is deliberately NOT
--    counted available; it's surfaced as a per-client gap for ops
--    (docs/V2-PHASE6-READY-BANK-GAPS.md).
--
-- 3. "Qualified" gets honest not-tracked semantics (NULL, rendered
--    "Not tracked"), replacing the card's client-side 5% guess and the
--    fake hardcoded 0:
--      acceleration_partners  TRACKED: 54,480 qualified (11,495 undecided → gap list)
--      cylindo                TRACKED: 22,918 qualified (21,966 undecided → gap list;
--                             NB the TAM itself is already fit-gated by fit_reach_out,
--                             the post-incident account-fit system)
--      paycaptain             NOT TRACKED: column exists but 193/92,967 = 0.2%
--                             populated — a qualification pass never ran; a count
--                             would imply "193 qualified of 93k" which is a lie
--      omnivate               NOT TRACKED: no qualification_decision column at all
--
-- Rollback: restore fn from 016 + ALTER COLUMN qualified SET NOT NULL,
--           SET DEFAULT 0 (after backfilling NULLs to 0).
-- =============================================================

ALTER TABLE public.cockpit_ready_bank_daily
  ALTER COLUMN qualified DROP NOT NULL,
  ALTER COLUMN qualified DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.fn_cockpit_snapshot_ready_bank()
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- cylindo (qualified TRACKED; TAM is fit_reach_out-gated)
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'cylindo', current_date,
      count(*),
      count(*) FILTER (WHERE t.qualification_decision = 'qualified'),
      count(*) FILTER (WHERE t.email_reachable),
      count(*) FILTER (WHERE t.linkedin_reachable AND NOT t.email_reachable),
      count(*) FILTER (WHERE ae.email IS NOT NULL),
      count(*) FILTER (WHERE t.email_reachable AND ae.email IS NULL AND NOT COALESCE(t.smartlead_uploaded, false))
    FROM v_cylindo_tam t
    LEFT JOIN v_cylindo_actually_emailed ae ON ae.email = lower(t.email)
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for cylindo: %', SQLERRM;
  END;

  -- paycaptain (qualified NOT TRACKED: 0.2% populated — see migration header)
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'paycaptain', current_date,
      count(*),
      NULL::integer,
      count(*) FILTER (WHERE t.email_reachable),
      count(*) FILTER (WHERE t.linkedin_reachable AND NOT t.email_reachable),
      count(*) FILTER (WHERE ae.email IS NOT NULL),
      count(*) FILTER (WHERE t.email_reachable AND ae.email IS NULL AND NOT COALESCE(t.smartlead_uploaded, false))
    FROM v_paycaptain_tam t
    LEFT JOIN v_paycaptain_actually_emailed ae ON ae.email = lower(t.email)
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for paycaptain: %', SQLERRM;
  END;

  -- acceleration_partners (qualified TRACKED)
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'acceleration_partners', current_date,
      count(*),
      count(*) FILTER (WHERE t.qualification_decision = 'qualified'),
      count(*) FILTER (WHERE t.email_reachable),
      count(*) FILTER (WHERE t.linkedin_reachable AND NOT t.email_reachable),
      count(*) FILTER (WHERE ae.email IS NOT NULL),
      count(*) FILTER (WHERE t.email_reachable AND ae.email IS NULL AND NOT COALESCE(t.smartlead_uploaded, false))
    FROM v_acceleration_partners_tam t
    LEFT JOIN v_acceleration_partners_actually_emailed ae ON ae.email = lower(t.email)
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for acceleration_partners: %', SQLERRM;
  END;

  -- omnivate (qualified NOT TRACKED: no qualification_decision column)
  BEGIN
    INSERT INTO cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, email_verified, linkedin_only, in_campaign, available_email)
    SELECT 'omnivate', current_date,
      count(*),
      NULL::integer,
      count(*) FILTER (WHERE t.email_reachable),
      count(*) FILTER (WHERE t.linkedin_reachable AND NOT t.email_reachable),
      count(*) FILTER (WHERE ae.email IS NOT NULL),
      count(*) FILTER (WHERE t.email_reachable AND ae.email IS NULL AND NOT COALESCE(t.smartlead_uploaded, false))
    FROM v_omnivate_tam t
    LEFT JOIN v_omnivate_actually_emailed ae ON ae.email = lower(t.email)
    ON CONFLICT (client, snapshot_date) DO UPDATE SET
      qualified_total = EXCLUDED.qualified_total,
      qualified       = EXCLUDED.qualified,
      email_verified  = EXCLUDED.email_verified,
      linkedin_only   = EXCLUDED.linkedin_only,
      in_campaign     = EXCLUDED.in_campaign,
      available_email = EXCLUDED.available_email,
      computed_at     = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ready-bank snapshot failed for omnivate: %', SQLERRM;
  END;
END;
$fn$;

-- Repopulate today's row with the corrected definitions
SELECT public.fn_cockpit_snapshot_ready_bank();
