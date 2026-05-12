-- Ordered calibration workflow steps (editable via /admin).
-- Vehicles reference steps by 0-based step_index aligned with `position`.

create table if not exists public.calibration_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calibration_workflow_steps_position_unique unique (position),
  constraint calibration_workflow_steps_position_nonneg check (position >= 0)
);

create or replace function public.set_calibration_workflow_steps_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists calibration_workflow_steps_set_updated_at on public.calibration_workflow_steps;
create trigger calibration_workflow_steps_set_updated_at
before update on public.calibration_workflow_steps
for each row execute procedure public.set_calibration_workflow_steps_updated_at();

-- Allow any non-negative step index; upper bound enforced in application from step count.
alter table public.calibration_vehicles drop constraint if exists calibration_vehicles_step_index_check;
alter table public.calibration_vehicles
  add constraint calibration_vehicles_step_index_nonneg check (step_index >= 0);

-- Seed default steps if table is empty (matches prior app defaults).
insert into public.calibration_workflow_steps (title, position)
select v.title, v.position
from (
  values
    ('Target Based Data Collection', 0),
    ('Vehicle Run Offload', 1),
    ('Target-Based Calibration Monitoring (Submitted)', 2),
    ('PR Generated [Need Review & Merge]', 3),
    ('PR Approved and Merged', 4),
    ('1-HR Targetless DC', 5),
    ('Data Ingestion', 6),
    ('Targetless PR Generated [Need Review & Merge]', 7)
) as v(title, position)
where not exists (select 1 from public.calibration_workflow_steps limit 1);
