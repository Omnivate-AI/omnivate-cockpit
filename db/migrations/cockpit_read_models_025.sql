-- V3 — Universal Lead Ledger re-point (ClickUp 869e3knmx, 2026-07-20).
--
-- Every client leads table now carries the Universal Lead Ledger (omnivate
-- repo: knowledge/system-rules/lead-table-qualification-schema.md § "The
-- Universal Lead Ledger"; migration 127): email_status + email_sendable,
-- outreach_status (none → uploaded → emailed → replied), reply_category.
-- The old snapshot read per-client improvised columns — most critically the
-- deprecated smartlead_uploaded flag (scheduled for a legacy_* rename that
-- would have silently frozen this snapshot) — through 4 hand-written
-- per-client arms with hard-coded qualification NULLing.
--
-- This rewrite is ONE template over a slug roster, reading ONLY standard
-- ledger columns:
--
--   qualified                 qualification_decision = 'qualified'
--   qualified_email_verified  ... AND email_sendable
--   email_verified            email_sendable (= verified + catch_all_verified)
--   linkedin_only             NOT email_sendable AND linkedin_url IS NOT NULL
--   in_campaign               outreach_status IN ('emailed','replied')
--   available_email           email_sendable AND outreach_status = 'none'
--                             ('none' = never uploaded, never emailed — the
--                             same conservative definition as migration 018,
--                             minus the deprecated flag)
--
-- TAM membership still comes from v_{slug}_tam (the canonical multi-channel
-- TAM view, task-blessed) JOINed to {slug}_leads by id: the TAM views were
-- created before the ledger columns landed and SELECT * freezes the column
-- list at creation, so they don't expose outreach_status/email_sendable.
--
-- "Not tracked" is now a uniform DATA-DRIVEN rule, not a client list:
-- qualified counters go NULL when <1% of the client's TAM has been judged
-- (qualification_decision IN ('qualified','disqualified')). PayCaptain
-- (0.2% judged) stays "Not tracked" per the migration-018 decision without
-- naming it in code; omnivate lacks the column entirely (upstream ledger
-- gap, flagged to Omar 2026-07-20) and NULLs via the column-existence probe.
--
-- email_sendable is nullable (NULL when email_status is NULL) — every read
-- COALESCEs it, per the V3 Phase 4 F2 lesson (NULL booleans vanish from
-- FILTER counts).

create or replace function fn_cockpit_snapshot_ready_bank()
 returns void
 language plpgsql
as $function$
declare
  slug text;
  has_qual boolean;
  qual_expr text;
  qual_verified_expr text;
begin
  foreach slug in array array['cylindo','paycaptain','acceleration_partners','omnivate'] loop
    begin
      -- Ledger coverage probe: omnivate_leads has no qualification_decision
      -- yet (the only standard column still missing anywhere, 2026-07-20).
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name  = slug || '_leads'
          and column_name = 'qualification_decision'
      ) into has_qual;

      if has_qual then
        qual_expr := $$
          case when count(*) filter (where l.qualification_decision in ('qualified','disqualified'))
                    >= 0.01 * count(*)
               then count(*) filter (where l.qualification_decision = 'qualified')
               else null::integer end$$;
        qual_verified_expr := $$
          case when count(*) filter (where l.qualification_decision in ('qualified','disqualified'))
                    >= 0.01 * count(*)
               then count(*) filter (where l.qualification_decision = 'qualified'
                                       and coalesce(l.email_sendable, false))
               else null::integer end$$;
      else
        qual_expr := 'null::integer';
        qual_verified_expr := 'null::integer';
      end if;

      execute format($q$
        insert into cockpit_ready_bank_daily
          (client, snapshot_date, qualified_total, qualified, qualified_email_verified,
           email_verified, linkedin_only, in_campaign, available_email)
        select %1$L, current_date,
          count(*),
          %2$s,
          %3$s,
          count(*) filter (where coalesce(l.email_sendable, false)),
          count(*) filter (where not coalesce(l.email_sendable, false) and l.linkedin_url is not null),
          count(*) filter (where l.outreach_status in ('emailed','replied')),
          count(*) filter (where coalesce(l.email_sendable, false) and l.outreach_status = 'none')
        from v_%1$s_tam t
        join %1$s_leads l on l.id = t.id
        on conflict (client, snapshot_date) do update set
          qualified_total          = excluded.qualified_total,
          qualified                = excluded.qualified,
          qualified_email_verified = excluded.qualified_email_verified,
          email_verified           = excluded.email_verified,
          linkedin_only            = excluded.linkedin_only,
          in_campaign              = excluded.in_campaign,
          available_email          = excluded.available_email,
          computed_at              = now()
      $q$, slug, qual_expr, qual_verified_expr);
    exception when others then
      raise warning 'ready-bank snapshot failed for %: %', slug, sqlerrm;
    end;
  end loop;
end;
$function$;
