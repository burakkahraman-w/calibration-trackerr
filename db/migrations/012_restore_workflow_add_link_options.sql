-- Restore workflow step titles; add separate link-name list for the Links panel.

-- Re-add workflow steps removed by 011 (positions 8–10).
insert into public.calibration_workflow_steps (title, position, link_enabled)
select v.title, v.position, v.link_enabled
from (
  values
    ('ADAS Verification Run Requested', 8, true),
    ('ADAS Verification Run Completed - Data Ingestion', 9, true),
    ('ADAS Verification Run Review', 10, false)
) as v(title, position, link_enabled)
where not exists (
  select 1 from public.calibration_workflow_steps w where w.position = v.position
);

-- Restore original calibration step titles (workflow / Next–Finish).
update public.calibration_workflow_steps w
set title = n.title,
    link_enabled = n.link_enabled
from (
  values
    (0, 'Target Based Data Collection', true),
    (1, 'Vehicle Run Offload', false),
    (2, 'Target-Based Calibration Monitoring (Submitted)', true),
    (3, 'PR Generated [Need Review & Merge]', true),
    (4, 'PR Approved and Merged', false),
    (5, '1-HR Targetless DC', true),
    (6, 'Data Ingestion', false),
    (7, 'Targetless PR Generated [Need Review & Merge]', true),
    (8, 'ADAS Verification Run Requested', true),
    (9, 'ADAS Verification Run Completed - Data Ingestion', true),
    (10, 'ADAS Verification Run Review', false)
) as n(position, title, link_enabled)
where w.position = n.position;

update public.calibration_vehicles v
set step_index = least(
  v.step_index,
  greatest(0, (select coalesce(max(position), 0) from public.calibration_workflow_steps))
)
where v.is_completed = false;

-- Link names (Links panel only — separate from workflow step titles).
create table if not exists public.calibration_link_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint calibration_link_options_name_unique unique (name)
);

create index if not exists calibration_link_options_sort_idx
  on public.calibration_link_options (sort_order, name);

insert into public.calibration_link_options (name, sort_order)
select v.name, v.ord
from (
  values
    ('Target-Based Calibration - Data Offload', 0),
    ('Target-Based Calibration - Monitoring [Slack]', 1),
    ('Target-Based Calibration - PR', 2),
    ('DC Run Request [Slack]', 3),
    ('Target-Less - Data Ingestion', 4),
    ('Target-Less - PR', 5),
    ('ADAS Verification Run Request [Slack]', 6),
    ('ADAS Verification Run - Data Ingestion', 7)
) as v(name, ord)
where not exists (select 1 from public.calibration_link_options limit 1);
