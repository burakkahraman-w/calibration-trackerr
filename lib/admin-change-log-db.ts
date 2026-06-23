import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { isMemoryBackend } from "@/lib/calibration-store-memory";

export type AdminChangeLogRow = {
  id: string;
  created_at: string;
  event_type: string;
  message: string;
};

const GLOBAL_LOG = "__calibration_tracker_admin_change_log__" as const;
const MAX_LOG_ROWS = 500;

function memoryLog(): AdminChangeLogRow[] {
  const g = globalThis as typeof globalThis & { [GLOBAL_LOG]?: AdminChangeLogRow[] };
  if (!g[GLOBAL_LOG]) g[GLOBAL_LOG] = [];
  return g[GLOBAL_LOG];
}

export function formatLogValue(value: string): string {
  const trimmed = value.trim();
  return trimmed || "(none)";
}

export async function appendAdminChangeLog(
  eventType: string,
  message: string,
): Promise<AdminChangeLogRow | null> {
  const type = eventType.trim();
  const text = message.trim();
  if (!type || !text) return null;

  if (isMemoryBackend()) {
    const row: AdminChangeLogRow = {
      id: `mem-log-${randomUUID()}`,
      created_at: new Date().toISOString(),
      event_type: type,
      message: text,
    };
    const log = memoryLog();
    log.unshift(row);
    if (log.length > MAX_LOG_ROWS) log.length = MAX_LOG_ROWS;
    return row;
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `insert into public.calibration_admin_change_log (event_type, message)
       values ($1, $2)
       returning id, created_at, event_type, message`,
      [type, text],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      event_type: String(row.event_type),
      message: String(row.message),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_admin_change_log|does not exist|undefined_table/i.test(msg)) throw e;
    return null;
  }
}

export async function listTrackerOwnerChangeLogs(limit = 200): Promise<AdminChangeLogRow[]> {
  const cap = Math.min(Math.max(1, limit), MAX_LOG_ROWS);

  if (isMemoryBackend()) {
    return memoryLog()
      .filter((row) => row.event_type === "tracker_owner_changed")
      .slice(0, cap);
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `select id, created_at, event_type, message
       from public.calibration_admin_change_log
       where event_type = $2
       order by created_at desc
       limit $1`,
      [cap, "tracker_owner_changed"],
    );
    return res.rows.map((r) => ({
      id: String(r.id),
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      event_type: String(r.event_type),
      message: String(r.message),
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_admin_change_log|does not exist|undefined_table/i.test(msg)) throw e;
    return [];
  }
}
