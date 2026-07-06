-- =============================================================
-- cockpit_read_models_011 - rotation-group capacity (Omar 2026-07-06:
-- "in terms of group A, what is our sending capacity? Not A plus B, just
-- A. Then all our mailboxes together. Then how many reserve do we have,
-- and what's the sending capacity of that reserve?")
-- =============================================================
-- sp_mailboxes.mailbox_group carries the A/B weekly-rotation assignment
-- (smartlead-operator work, 2026-07): the on-week group's boxes are
-- lifecycle 'active' at ~30/day caps; the off-week group is 'resting' at
-- the 5/day follow-up allowance. Capacity sums are therefore honest about
-- what each group can send TODAY. 'reserve'-group and NULL-group boxes
-- exist (bench/legacy) - surfaced as their own lines, never hidden.
-- Rollback: DROP VIEW IF EXISTS public.vw_cockpit_rotation_capacity;
-- =============================================================

CREATE OR REPLACE VIEW public.vw_cockpit_rotation_capacity AS
SELECT
  client,
  -- Group A (whatever week-mode it is currently in)
  count(*) FILTER (WHERE mailbox_group = 'A')                                        AS group_a_boxes,
  COALESCE(sum(max_email_per_day) FILTER (WHERE mailbox_group = 'A'), 0)::int       AS group_a_capacity,
  count(*) FILTER (WHERE mailbox_group = 'A' AND lifecycle_status = 'active')        AS group_a_active_boxes,
  -- Group B
  count(*) FILTER (WHERE mailbox_group = 'B')                                        AS group_b_boxes,
  COALESCE(sum(max_email_per_day) FILTER (WHERE mailbox_group = 'B'), 0)::int       AS group_b_capacity,
  count(*) FILTER (WHERE mailbox_group = 'B' AND lifecycle_status = 'active')        AS group_b_active_boxes,
  -- The deployed pool = everything in the weekly rotation (active + resting)
  count(*) FILTER (WHERE lifecycle_status IN ('active','resting'))                   AS pool_boxes,
  COALESCE(sum(max_email_per_day) FILTER (WHERE lifecycle_status IN ('active','resting')), 0)::int AS pool_capacity,
  -- Bench
  count(*) FILTER (WHERE lifecycle_status = 'reserve')                               AS reserve_boxes,
  COALESCE(sum(max_email_per_day) FILTER (WHERE lifecycle_status = 'reserve'), 0)::int AS reserve_capacity,
  count(*) FILTER (WHERE lifecycle_status = 'warming')                               AS warming_boxes,
  -- Boxes in the rotation pool without a group assignment (should be 0;
  -- nonzero = the tag/group backfill missed them)
  count(*) FILTER (WHERE mailbox_group IS NULL AND lifecycle_status IN ('active','resting')) AS ungrouped_pool_boxes
FROM sp_mailboxes
WHERE lifecycle_status NOT IN ('retired','parked')
  AND NOT COALESCE(is_master_inbox, false)
GROUP BY client;
