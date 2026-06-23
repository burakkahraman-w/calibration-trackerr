import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { DEFAULT_LINK_OPTION_NAMES } from "@/lib/fleet-options";
import { isMemoryBackend } from "@/lib/calibration-store-memory";

export type LinkOptionRow = { id: string; name: string; sort_order: number };

const LINKS_TABLE_MISSING_HINT =
  "Link names table missing. Run db/migrations/012_restore_workflow_add_link_options.sql, then try again.";

const GLOBAL_LINKS = "__calibration_tracker_link_options__" as const;

function linkMap(): Map<string, LinkOptionRow> {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_LINKS]?: Map<string, LinkOptionRow>;
  };
  if (!g[GLOBAL_LINKS]) {
    g[GLOBAL_LINKS] = new Map();
    let ord = 0;
    for (const name of DEFAULT_LINK_OPTION_NAMES) {
      const id = `mem-link-${ord}`;
      g[GLOBAL_LINKS].set(id, { id, name, sort_order: ord });
      ord += 1;
    }
  }
  return g[GLOBAL_LINKS];
}

function memoryList(): LinkOptionRow[] {
  return Array.from(linkMap().values()).sort((a, b) => a.sort_order - b.sort_order);
}

export async function listLinkOptions(): Promise<LinkOptionRow[]> {
  if (isMemoryBackend()) {
    return memoryList();
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `select id, name, sort_order from public.calibration_link_options order by sort_order asc, name asc`,
    );
    const rows = res.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      sort_order: Number(r.sort_order),
    }));
    if (rows.length > 0) return rows;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_link_options|does not exist|undefined_table/i.test(msg)) throw e;
  }
  return DEFAULT_LINK_OPTION_NAMES.map((name, i) => ({
    id: `static-${i}-${name}`,
    name,
    sort_order: i,
  }));
}

export async function insertLinkOption(name: string): Promise<LinkOptionRow> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Link name is required");

  if (isMemoryBackend()) {
    const map = linkMap();
    const maxOrder = Math.max(-1, ...Array.from(map.values()).map((o) => o.sort_order));
    if (Array.from(map.values()).some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error("Link name already exists");
    }
    const id = `mem-link-${randomUUID()}`;
    const row: LinkOptionRow = { id, name: trimmed, sort_order: maxOrder + 1 };
    map.set(id, row);
    return row;
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `insert into public.calibration_link_options (name, sort_order)
       values (
         $1,
         coalesce((select max(sort_order) + 1 from public.calibration_link_options), 0)
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
    if (err.code === "23505") throw new Error("Link name already exists");
    if (err.code === "42P01" || /calibration_link_options|does not exist/i.test(err.message ?? "")) {
      throw new Error(LINKS_TABLE_MISSING_HINT);
    }
    throw e;
  }
}

export async function deleteLinkOption(id: string): Promise<boolean> {
  if (isMemoryBackend()) {
    const map = linkMap();
    if (map.size <= 1) throw new Error("At least one link name is required.");
    return map.delete(id);
  }

  if (id.startsWith("static-")) {
    throw new Error(LINKS_TABLE_MISSING_HINT);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const cnt = await client.query<{ c: string }>(
      `select count(*)::text as c from public.calibration_link_options`,
    );
    if (Number(cnt.rows[0]?.c ?? 0) <= 1) {
      await client.query("rollback");
      throw new Error("At least one link name is required.");
    }
    const del = await client.query<{ sort_order: number }>(
      `delete from public.calibration_link_options where id = $1 returning sort_order`,
      [id],
    );
    if (del.rowCount === 0) {
      await client.query("rollback");
      return false;
    }
    const removedOrder = Number(del.rows[0]!.sort_order);
    await client.query(
      `update public.calibration_link_options set sort_order = sort_order - 1 where sort_order > $1`,
      [removedOrder],
    );
    await client.query("commit");
    return true;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function isValidLinkIndex(index: number): Promise<boolean> {
  const options = await listLinkOptions();
  return Number.isInteger(index) && index >= 0 && index < options.length;
}
