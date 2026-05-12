import { getPool } from "@/lib/db";
import { isMemoryBackend } from "@/lib/calibration-store-memory";

const ACTIVE_OWNER_KEY = "active_calibration_owner" as const;

const GLOBAL_ACTIVE = "__calibration_tracker_active_calibration_owner__" as const;

export async function getActiveCalibrationOwner(): Promise<string> {
  if (isMemoryBackend()) {
    const g = globalThis as typeof globalThis & { [GLOBAL_ACTIVE]?: string };
    return String(g[GLOBAL_ACTIVE] ?? "").trim();
  }

  const pool = getPool();
  try {
    const res = await pool.query<{ value: string }>(
      `select value from public.calibration_app_settings where key = $1`,
      [ACTIVE_OWNER_KEY],
    );
    const v = res.rows[0]?.value;
    return v == null ? "" : String(v).trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_app_settings|does not exist|undefined_table/i.test(msg)) throw e;
    return "";
  }
}

export async function setActiveCalibrationOwner(owner: string): Promise<string> {
  const trimmed = owner.trim();

  if (isMemoryBackend()) {
    const g = globalThis as typeof globalThis & { [GLOBAL_ACTIVE]?: string };
    g[GLOBAL_ACTIVE] = trimmed;
    return trimmed;
  }

  const pool = getPool();
  try {
    await pool.query(
      `insert into public.calibration_app_settings (key, value)
       values ($1, $2)
       on conflict (key) do update set value = excluded.value`,
      [ACTIVE_OWNER_KEY, trimmed],
    );
    return trimmed;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/calibration_app_settings|does not exist|undefined_table/i.test(msg)) throw e;
    throw new Error(
      "Settings table missing. Run db/migrations/005_calibration_app_settings.sql on your database, then try again.",
    );
  }
}
