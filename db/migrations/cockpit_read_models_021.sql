-- V3 Phase 4 (F1/F2/F3) — Ready Bank truth fixes.
--
-- F2  linkedin_only was massively under-counted (AP 10, Omnivate 0) because the
--     filter `linkedin_reachable AND NOT email_reachable` evaluates to NULL —
--     not TRUE — whenever email_reachable is NULL (a lead with no verified
--     email). Postgres drops NULL from a FILTER, so every "on LinkedIn, no
--     email" lead vanished. COALESCE(email_reachable,false) restores them
--     (AP -> 32,353, Omnivate -> 148,010; Cylindo unchanged at 13,256 because
--     its view already returned strict booleans).
--
-- F1/F3  New column qualified_email_verified = qualified AND email-verified, so
--     the card can lead with "Qualified" then "Qualified + verified email"
--     (Omar: "start with qualified … then the ones that have verified emails
--     from our qualified term"). NULL for clients that don't track
--     qualification (omnivate: no column; paycaptain: never ran).

alter table cockpit_ready_bank_daily
  add column if not exists qualified_email_verified integer;

create or replace function fn_cockpit_snapshot_ready_bank()
 returns void
 language plpgsql
as $function$
begin
  -- cylindo (qualification TRACKED; TAM is fit_reach_out-gated)
  begin
    insert into cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, qualified_email_verified,
       email_verified, linkedin_only, in_campaign, available_email)
    select 'cylindo', current_date,
      count(*),
      count(*) filter (where t.qualification_decision = 'qualified'),
      count(*) filter (where t.qualification_decision = 'qualified' and coalesce(t.email_reachable, false)),
      count(*) filter (where t.email_reachable),
      count(*) filter (where coalesce(t.linkedin_reachable, false) and not coalesce(t.email_reachable, false)),
      count(*) filter (where ae.email is not null),
      count(*) filter (where t.email_reachable and ae.email is null and not coalesce(t.smartlead_uploaded, false))
    from v_cylindo_tam t
    left join v_cylindo_actually_emailed ae on ae.email = lower(t.email)
    on conflict (client, snapshot_date) do update set
      qualified_total          = excluded.qualified_total,
      qualified                = excluded.qualified,
      qualified_email_verified = excluded.qualified_email_verified,
      email_verified           = excluded.email_verified,
      linkedin_only            = excluded.linkedin_only,
      in_campaign              = excluded.in_campaign,
      available_email          = excluded.available_email,
      computed_at              = now();
  exception when others then
    raise warning 'ready-bank snapshot failed for cylindo: %', sqlerrm;
  end;

  -- paycaptain (qualification NOT TRACKED: 0.2% populated)
  begin
    insert into cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, qualified_email_verified,
       email_verified, linkedin_only, in_campaign, available_email)
    select 'paycaptain', current_date,
      count(*),
      null::integer,
      null::integer,
      count(*) filter (where t.email_reachable),
      count(*) filter (where coalesce(t.linkedin_reachable, false) and not coalesce(t.email_reachable, false)),
      count(*) filter (where ae.email is not null),
      count(*) filter (where t.email_reachable and ae.email is null and not coalesce(t.smartlead_uploaded, false))
    from v_paycaptain_tam t
    left join v_paycaptain_actually_emailed ae on ae.email = lower(t.email)
    on conflict (client, snapshot_date) do update set
      qualified_total          = excluded.qualified_total,
      qualified                = excluded.qualified,
      qualified_email_verified = excluded.qualified_email_verified,
      email_verified           = excluded.email_verified,
      linkedin_only            = excluded.linkedin_only,
      in_campaign              = excluded.in_campaign,
      available_email          = excluded.available_email,
      computed_at              = now();
  exception when others then
    raise warning 'ready-bank snapshot failed for paycaptain: %', sqlerrm;
  end;

  -- acceleration_partners (qualification TRACKED)
  begin
    insert into cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, qualified_email_verified,
       email_verified, linkedin_only, in_campaign, available_email)
    select 'acceleration_partners', current_date,
      count(*),
      count(*) filter (where t.qualification_decision = 'qualified'),
      count(*) filter (where t.qualification_decision = 'qualified' and coalesce(t.email_reachable, false)),
      count(*) filter (where t.email_reachable),
      count(*) filter (where coalesce(t.linkedin_reachable, false) and not coalesce(t.email_reachable, false)),
      count(*) filter (where ae.email is not null),
      count(*) filter (where t.email_reachable and ae.email is null and not coalesce(t.smartlead_uploaded, false))
    from v_acceleration_partners_tam t
    left join v_acceleration_partners_actually_emailed ae on ae.email = lower(t.email)
    on conflict (client, snapshot_date) do update set
      qualified_total          = excluded.qualified_total,
      qualified                = excluded.qualified,
      qualified_email_verified = excluded.qualified_email_verified,
      email_verified           = excluded.email_verified,
      linkedin_only            = excluded.linkedin_only,
      in_campaign              = excluded.in_campaign,
      available_email          = excluded.available_email,
      computed_at              = now();
  exception when others then
    raise warning 'ready-bank snapshot failed for acceleration_partners: %', sqlerrm;
  end;

  -- omnivate (qualification NOT TRACKED: no qualification_decision column)
  begin
    insert into cockpit_ready_bank_daily
      (client, snapshot_date, qualified_total, qualified, qualified_email_verified,
       email_verified, linkedin_only, in_campaign, available_email)
    select 'omnivate', current_date,
      count(*),
      null::integer,
      null::integer,
      count(*) filter (where t.email_reachable),
      count(*) filter (where coalesce(t.linkedin_reachable, false) and not coalesce(t.email_reachable, false)),
      count(*) filter (where ae.email is not null),
      count(*) filter (where t.email_reachable and ae.email is null and not coalesce(t.smartlead_uploaded, false))
    from v_omnivate_tam t
    left join v_omnivate_actually_emailed ae on ae.email = lower(t.email)
    on conflict (client, snapshot_date) do update set
      qualified_total          = excluded.qualified_total,
      qualified                = excluded.qualified,
      qualified_email_verified = excluded.qualified_email_verified,
      email_verified           = excluded.email_verified,
      linkedin_only            = excluded.linkedin_only,
      in_campaign              = excluded.in_campaign,
      available_email          = excluded.available_email,
      computed_at              = now();
  exception when others then
    raise warning 'ready-bank snapshot failed for omnivate: %', sqlerrm;
  end;
end;
$function$;
