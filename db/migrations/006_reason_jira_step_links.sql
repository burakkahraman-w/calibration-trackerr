-- Start calibration: reason + Jira ticket; per-step links on vehicles; link toggle on workflow steps.

alter table public.calibration_vehicles
  add column if not exists reason text not null default '';

alter table public.calibration_vehicles
  add column if not exists jira_ticket text not null default '';

alter table public.calibration_vehicles
  add column if not exists step_links jsonb not null default '{}'::jsonb;

alter table public.calibration_workflow_steps
  add column if not exists link_enabled boolean not null default false;

-- Enable link field on PR-related steps by default.
update public.calibration_workflow_steps
set link_enabled = true
where title ilike '%PR Generated%'
  and link_enabled = false;
