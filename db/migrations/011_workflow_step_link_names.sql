-- Rename workflow steps to the new link labels (8 steps); drop any extras beyond position 7.

update public.calibration_vehicles
set step_index = 7
where is_completed = false
  and step_index > 7;

delete from public.calibration_workflow_steps
where position > 7;

insert into public.calibration_workflow_steps (title, position, link_enabled)
select n.title, n.position, true
from (
  values
    (0, 'Target-Based Calibration - Data Offload'),
    (1, 'Target-Based Calibration - Monitoring [Slack]'),
    (2, 'Target-Based Calibration - PR'),
    (3, 'DC Run Request [Slack]'),
    (4, 'Target-Less - Data Ingestion'),
    (5, 'Target-Less - PR'),
    (6, 'ADAS Verification Run Request [Slack]'),
    (7, 'ADAS Verification Run - Data Ingestion')
) as n(position, title)
where not exists (
  select 1
  from public.calibration_workflow_steps w
  where w.position = n.position
);

update public.calibration_workflow_steps w
set title = n.title,
    link_enabled = true
from (
  values
    (0, 'Target-Based Calibration - Data Offload'),
    (1, 'Target-Based Calibration - Monitoring [Slack]'),
    (2, 'Target-Based Calibration - PR'),
    (3, 'DC Run Request [Slack]'),
    (4, 'Target-Less - Data Ingestion'),
    (5, 'Target-Less - PR'),
    (6, 'ADAS Verification Run Request [Slack]'),
    (7, 'ADAS Verification Run - Data Ingestion')
) as n(position, title)
where w.position = n.position;

update public.calibration_vehicles v
set step_index = least(
  v.step_index,
  greatest(0, (select coalesce(max(position), 0) from public.calibration_workflow_steps))
)
where v.is_completed = false;
