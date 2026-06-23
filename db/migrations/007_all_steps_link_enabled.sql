-- Enable step link fields on every workflow step.

update public.calibration_workflow_steps
set link_enabled = true;

alter table public.calibration_workflow_steps
  alter column link_enabled set default true;
