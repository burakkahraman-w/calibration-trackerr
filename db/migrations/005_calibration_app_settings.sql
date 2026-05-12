-- Key/value app settings (e.g. default owner pre-selected on the public tracker).
create table if not exists public.calibration_app_settings (
  key text primary key,
  value text not null default ''
);

insert into public.calibration_app_settings (key, value)
values ('active_calibration_owner', '')
on conflict (key) do nothing;
