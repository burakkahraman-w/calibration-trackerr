create table if not exists public.calibration_vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_name text not null,
  owner text not null default '',
  performed_at timestamptz not null,
  step_index int not null default 0
    check (step_index >= 0 and step_index <= 7),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_calibration_vehicles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists calibration_vehicles_set_updated_at on public.calibration_vehicles;
create trigger calibration_vehicles_set_updated_at
before update on public.calibration_vehicles
for each row execute procedure public.set_calibration_vehicles_updated_at();
