create table if not exists public.calibration_owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint calibration_owners_name_unique unique (name)
);

create index if not exists calibration_owners_sort_idx
  on public.calibration_owners (sort_order, name);

insert into public.calibration_owners (name, sort_order)
select v.name, v.ord
from (
  values
    ('Team member A', 0),
    ('Team member B', 1),
    ('Team member C', 2)
) as v(name, ord)
where not exists (select 1 from public.calibration_owners limit 1);
