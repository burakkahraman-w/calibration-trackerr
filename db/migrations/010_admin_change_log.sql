-- Admin panel change log (owner changes and other admin actions).

create table if not exists public.calibration_admin_change_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  message text not null
);

create index if not exists calibration_admin_change_log_created_idx
  on public.calibration_admin_change_log (created_at desc);
