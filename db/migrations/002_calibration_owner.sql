alter table public.calibration_vehicles
  add column if not exists owner text not null default '';
