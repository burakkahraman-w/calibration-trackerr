-- Vehicle dropdown options (editable via /admin).

create table if not exists public.calibration_vehicle_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint calibration_vehicle_options_name_unique unique (name)
);

create index if not exists calibration_vehicle_options_sort_idx
  on public.calibration_vehicle_options (sort_order, name);

insert into public.calibration_vehicle_options (name, sort_order)
select v.name, v.ord
from (
  values
    ('fme10000', 0),
    ('fme10001', 1),
    ('fme10002', 2),
    ('fme10003', 3),
    ('fme10004', 4),
    ('fme10005', 5),
    ('fme10006', 6),
    ('fme10007', 7),
    ('fme10008', 8),
    ('fme10009', 9),
    ('fme10010', 10),
    ('fme10011', 11),
    ('fme10012', 12),
    ('fme10013', 13),
    ('fme10014', 14),
    ('fme10015', 15),
    ('fme10016', 16),
    ('fme10017', 17),
    ('fme10018', 18),
    ('fme10019', 19),
    ('fme10020', 20)
) as v(name, ord)
where not exists (select 1 from public.calibration_vehicle_options limit 1);

-- Backfill custom names already used on the tracker (e.g. via "Others").
insert into public.calibration_vehicle_options (name, sort_order)
select d.name, 1000 + d.rn
from (
  select distinct btrim(vehicle_name) as name,
         row_number() over (order by lower(btrim(vehicle_name))) as rn
  from public.calibration_vehicles
  where btrim(vehicle_name) <> ''
    and lower(btrim(vehicle_name)) <> 'others'
) d
where not exists (
  select 1
  from public.calibration_vehicle_options o
  where lower(o.name) = lower(d.name)
)
on conflict (name) do nothing;
