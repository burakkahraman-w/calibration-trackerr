-- Split Target-Less - Data Ingestion into three numbered link slots.

create or replace function public.remap_step_links_add_targetless_slots(links jsonb)
returns jsonb
language plpgsql
as $$
declare
  out_links jsonb := '{}'::jsonb;
  k text;
  v text;
  new_k text;
  n int;
begin
  if links is null or links = '{}'::jsonb then
    return '{}'::jsonb;
  end if;

  for k, v in select * from jsonb_each_text(links) loop
    if k ~ '^\d+$' then
      n := k::int;
      if n >= 5 then
        new_k := (n + 2)::text;
      else
        new_k := k;
      end if;
      if btrim(v) <> '' then
        out_links := out_links || jsonb_build_object(new_k, btrim(v));
      end if;
    end if;
  end loop;

  return out_links;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.calibration_link_options
    where name = 'Target-Less - Data Ingestion'
  ) then
    update public.calibration_vehicles
    set step_links = public.remap_step_links_add_targetless_slots(step_links)
    where step_links is not null
      and step_links <> '{}'::jsonb;

    update public.calibration_link_options
    set sort_order = sort_order + 2
    where sort_order >= 5;

    update public.calibration_link_options
    set name = 'Target-Less - Data Ingestion 1'
    where name = 'Target-Less - Data Ingestion';

    insert into public.calibration_link_options (name, sort_order)
    values
      ('Target-Less - Data Ingestion 2', 5),
      ('Target-Less - Data Ingestion 3', 6);
  end if;
end;
$$;
