import { randomUUID } from "crypto";
import type { QueryResult } from "pg";
import { getPool } from "@/lib/db";
import { OWNER_DROPDOWN_OPTIONS } from "@/lib/fleet-options";
import { isMemoryBackend } from "@/lib/calibration-store-memory";

export type OwnerOptionRow = { id: string; name: string; sort_order: number };

const OWNERS_TABLE_MISSING_HINT =
  "Owners table missing. Run db/migrations/003_calibration_owners.sql in the Supabase SQL editor, then try again.";

const GLOBAL_OWNERS = "__calibration_tracker_owners__" as const;

function ownerMap(): Map<string, OwnerOptionRow> {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_OWNERS]?: Map<string, OwnerOptionRow>;
  };
  if (!g[GLOBAL_OWNERS]) {
    g[GLOBAL_OWNERS] = new Map();
    let ord = 0;
    for (const name of OWNER_DROPDOWN_OPTIONS) {
      const id = `mem-owner-${ord}`;
      g[GLOBAL_OWNERS].set(id, { id, name, sort_order: ord });
      ord += 1;
    }
  }
  return g[GLOBAL_OWNERS];
}

function memoryList(): OwnerOptionRow[] {
  return Array.from(ownerMap().values()).sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

export async function listOwnerOptions(): Promise<string[]> {
  if (isMemoryBackend()) {
    const names = memoryList().map((r) => r.name);
    if (names.length > 0) return names;
    return [...OWNER_DROPDOWN_OPTIONS];
  }

  const pool = getPool();
  try {
    const res = await pool.query<{ name: string }>(
      `select name from public.calibration_owners order by sort_order asc, name asc`,
    );
    const names = res.rows.map((r) => r.name);
    if (names.length > 0) return names;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_owners|does not exist|undefined_table/i.test(msg)) throw e;
  }
  return [...OWNER_DROPDOWN_OPTIONS];
}

export async function listOwnerRows(): Promise<OwnerOptionRow[]> {
  if (isMemoryBackend()) {
    return memoryList();
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `select id, name, sort_order from public.calibration_owners order by sort_order asc, name asc`,
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sort_order: Number(r.sort_order),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_owners|does not exist|undefined_table/i.test(msg)) throw e;
    return OWNER_DROPDOWN_OPTIONS.map((name, i) => ({
      id: `static-${i}-${name}`,
      name,
      sort_order: i,
    }));
  }
}

export async function insertOwnerOption(name: string): Promise<OwnerOptionRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Owner name is required");

  if (isMemoryBackend()) {
    const map = ownerMap();
    const maxOrder = Math.max(0, ...Array.from(map.values()).map((o) => o.sort_order));
    const id = `mem-owner-${randomUUID()}`;
    if (Array.from(map.values()).some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Owner already exists");
    }
    const row: OwnerOptionRow = { id, name: trimmed, sort_order: maxOrder + 1 };
    map.set(id, row);
    return row;
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `insert into public.calibration_owners (name, sort_order)
       values (
         $1,
         coalesce((select max(sort_order) + 1 from public.calibration_owners), 0)
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
    if (err.code === "23505") throw new Error("Owner already exists");
    if (err.code === "42P01" || /calibration_owners|does not exist/i.test(err.message ?? "")) {
      throw new Error(OWNERS_TABLE_MISSING_HINT);
    }
    throw e;
  }
}

export async function deleteOwnerOption(id: string): Promise<boolean> {
  if (isMemoryBackend()) {
    return ownerMap().delete(id);
  }

  if (id.startsWith("static-")) {
    // listOwnerRows() uses these ids only when the table query failed (table missing).
    throw new Error(OWNERS_TABLE_MISSING_HINT);
  }

  const pool = getPool();
  try {
    const res: QueryResult = await pool.query(`delete from public.calibration_owners where id = $1`, [
      id,
    ]);
    return res.rowCount != null && res.rowCount > 0;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42P01" || /calibration_owners|does not exist/i.test(err.message ?? "")) {
      throw new Error(OWNERS_TABLE_MISSING_HINT);
    }
    throw e;
  }
}
