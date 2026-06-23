-- Remap step_links keys from old workflow step positions to link-option indices (0–7).

create or replace function public.remap_calibration_step_links(links jsonb)
returns jsonb
language plpgsql
as $$
declare
  mapping constant text[][] := array[
    array['0', '0'],
    array['2', '1'],
    array['3', '2'],
    array['5', '3'],
    array['6', '4'],
    array['7', '5'],
    array['8', '6'],
    array['9', '7']
  ];
  pair text[];
  old_key text;
  new_key text;
  val text;
  out_links jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  if links is null or links = '{}'::jsonb then
    return '{}'::jsonb;
  end if;

  foreach pair slice 1 in array mapping loop
    old_key := pair[1];
    new_key := pair[2];
    if links ? old_key then
      val := btrim(links ->> old_key);
      if val <> '' then
        out_links := out_links || jsonb_build_object(new_key, val);
      end if;
    end if;
  end loop;

  -- Keep entries already stored under link-option indices (new format).
  for k, v in select * from jsonb_each_text(links) loop
    if k ~ '^[0-7]$' and btrim(v) <> '' and not (out_links ? k) then
      out_links := out_links || jsonb_build_object(k, btrim(v));
    end if;
  end loop;

  return out_links;
end;
$$;

update public.calibration_vehicles
set step_links = public.remap_calibration_step_links(step_links)
where step_links is not null
  and step_links <> '{}'::jsonb;
