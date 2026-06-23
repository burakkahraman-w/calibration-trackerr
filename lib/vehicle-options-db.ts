import { randomUUID } from "crypto";
import type { QueryResult } from "pg";
import { getPool } from "@/lib/db";
import { DEFAULT_FLEET_VEHICLE_OPTIONS } from "@/lib/fleet-options";
import { isMemoryBackend } from "@/lib/calibration-store-memory";

export type VehicleOptionRow = { id: string; name: string; sort_order: number };

const VEHICLES_TABLE_MISSING_HINT =
  "Vehicles table missing. Run db/migrations/009_calibration_vehicle_options.sql, then try again.";

const GLOBAL_VEHICLES = "__calibration_tracker_vehicle_options__" as const;

function vehicleMap(): Map<string, VehicleOptionRow> {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_VEHICLES]?: Map<string, VehicleOptionRow>;
  };
  if (!g[GLOBAL_VEHICLES]) {
    g[GLOBAL_VEHICLES] = new Map();
    let ord = 0;
    for (const name of DEFAULT_FLEET_VEHICLE_OPTIONS) {
      const id = `mem-vehicle-${ord}`;
      g[GLOBAL_VEHICLES].set(id, { id, name, sort_order: ord });
      ord += 1;
    }
  }
  return g[GLOBAL_VEHICLES];
}

function compareVehicleNames(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function memoryList(): VehicleOptionRow[] {
  return Array.from(vehicleMap().values()).sort(compareVehicleNames);
}

export async function listVehicleOptions(): Promise<string[]> {
  if (isMemoryBackend()) {
    const names = memoryList().map((r) => r.name);
    if (names.length > 0) return names;
    return [...DEFAULT_FLEET_VEHICLE_OPTIONS];
  }

  const pool = getPool();
  try {
    const res = await pool.query<{ name: string }>(
      `select name from public.calibration_vehicle_options order by lower(name) asc`,
    );
    const names = res.rows.map((r) => r.name);
    if (names.length > 0) return names;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_vehicle_options|does not exist|undefined_table/i.test(msg)) throw e;
  }
  return [...DEFAULT_FLEET_VEHICLE_OPTIONS];
}

export async function listVehicleRows(): Promise<VehicleOptionRow[]> {
  if (isMemoryBackend()) {
    return memoryList();
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `select id, name, sort_order from public.calibration_vehicle_options order by lower(name) asc`,
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sort_order: Number(r.sort_order),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_vehicle_options|does not exist|undefined_table/i.test(msg)) throw e;
    return DEFAULT_FLEET_VEHICLE_OPTIONS.map((name, i) => ({
      id: `static-${i}-${name}`,
      name,
      sort_order: i,
    }));
  }
}

export async function insertVehicleOption(name: string): Promise<VehicleOptionRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Vehicle name is required");
  if (trimmed.toLowerCase() === "others") throw new Error("“Others” is reserved for the tracker.");

  if (isMemoryBackend()) {
    const map = vehicleMap();
    const maxOrder = Math.max(0, ...Array.from(map.values()).map((o) => o.sort_order));
    if (Array.from(map.values()).some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Vehicle already exists");
    }
    const id = `mem-vehicle-${randomUUID()}`;
    const row: VehicleOptionRow = { id, name: trimmed, sort_order: maxOrder + 1 };
    map.set(id, row);
    return row;
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `insert into public.calibration_vehicle_options (name, sort_order)
       values (
         $1,
         coalesce((select max(sort_order) + 1 from public.calibration_vehicle_options), 0)
       )
       returning id, name, sort_order`,
      [trimmed],
    );
    const row = res.rows[0];
    if (!row) throw new Error("Insert returned no row");
    return {
      id: String(row.id),
      name: String(row.name),
      sort_order: Number(row.sort_order),
    };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23505") throw new Error("Vehicle already exists");
    if (err.code === "42P01" || /calibration_vehicle_options|does not exist/i.test(err.message ?? "")) {
      throw new Error(VEHICLES_TABLE_MISSING_HINT);
    }
    throw e;
  }
}

/** Add to dropdown if missing (e.g. after “Others” on the public tracker). */
export async function ensureVehicleOption(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === "others") return;

  if (isMemoryBackend()) {
    const map = vehicleMap();
    if (Array.from(map.values()).some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) return;
    const maxOrder = Math.max(0, ...Array.from(map.values()).map((o) => o.sort_order));
    const id = `mem-vehicle-${randomUUID()}`;
    map.set(id, { id, name: trimmed, sort_order: maxOrder + 1 });
    return;
  }

  const pool = getPool();
  try {
    await pool.query(
      `insert into public.calibration_vehicle_options (name, sort_order)
       select $1, coalesce((select max(sort_order) + 1 from public.calibration_vehicle_options), 0)
       where not exists (
         select 1 from public.calibration_vehicle_options where lower(name) = lower($1)
       )`,
      [trimmed],
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_vehicle_options|does not exist|undefined_table/i.test(msg)) throw e;
  }
}

export async function deleteVehicleOption(id: string): Promise<boolean> {
  if (isMemoryBackend()) {
    return vehicleMap().delete(id);
  }

  if (id.startsWith("static-")) {
    throw new Error(VEHICLES_TABLE_MISSING_HINT);
  }

  const pool = getPool();
  try {
    const res: QueryResult = await pool.query(
      `delete from public.calibration_vehicle_options where id = $1`,
      [id],
    );
    return res.rowCount != null && res.rowCount > 0;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42P01" || /calibration_vehicle_options|does not exist/i.test(err.message ?? "")) {
      throw new Error(VEHICLES_TABLE_MISSING_HINT);
    }
    throw e;
  }
}
