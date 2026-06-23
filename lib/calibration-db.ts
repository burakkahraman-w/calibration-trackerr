import type { QueryResult } from "pg";
import { getPool } from "@/lib/db";
import type { CalibrationVehicleRow } from "@/lib/types";
import {
  deleteMemoryCompletedVehicles,
  deleteMemoryVehicle,
  getMemoryVehicleById,
  insertMemoryVehicle,
  isMemoryBackend,
  listMemoryVehicles,
  updateMemoryVehicleOwner,
  updateMemoryVehicleStepLink,
  updateMemoryVehicleStep as updateMemoryStep,
} from "@/lib/calibration-store-memory";

const ROW_SELECT = `id, vehicle_name, owner, reason, jira_ticket, performed_at, step_index, step_links, is_completed, completed_at, created_at, updated_at`;

function parseStepLinks(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
    return out;
  }
  if (typeof raw === "string") {
    try {
      return parseStepLinks(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  return {};
}

function iso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return String(v);
}

function mapRow(row: Record<string, unknown>): CalibrationVehicleRow {
  return {
    id: String(row.id),
    vehicle_name: String(row.vehicle_name),
    owner: row.owner == null || row.owner === "" ? "" : String(row.owner),
    reason: row.reason == null ? "" : String(row.reason),
    jira_ticket: row.jira_ticket == null ? "" : String(row.jira_ticket),
    performed_at: iso(row.performed_at),
    step_index: Number(row.step_index),
    step_links: parseStepLinks(row.step_links),
    is_completed: Boolean(row.is_completed),
    completed_at: row.completed_at == null ? null : iso(row.completed_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
  };
}

function firstRow<T extends Record<string, unknown>>(
  res: QueryResult<T>,
): CalibrationVehicleRow | null {
  const row = res.rows[0];
  return row ? mapRow(row) : null;
}

export { isMemoryBackend };

export async function listCalibrationVehicles(): Promise<CalibrationVehicleRow[]> {
  if (isMemoryBackend()) {
    return listMemoryVehicles();
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `select ${ROW_SELECT}
     from public.calibration_vehicles
     order by performed_at desc`,
  );
  return res.rows.map((r) => mapRow(r));
}

export async function insertCalibrationVehicle(input: {
  vehicle_name: string;
  owner: string;
  reason: string;
  jira_ticket: string;
  performed_at: Date;
}): Promise<CalibrationVehicleRow> {
  if (isMemoryBackend()) {
    return insertMemoryVehicle(input);
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `insert into public.calibration_vehicles (vehicle_name, owner, reason, jira_ticket, performed_at, step_index, is_completed)
     values ($1, $2, $3, $4, $5, 0, false)
     returning ${ROW_SELECT}`,
    [
      input.vehicle_name,
      input.owner,
      input.reason,
      input.jira_ticket,
      input.performed_at.toISOString(),
    ],
  );
  const row = firstRow(res);
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function getCalibrationVehicleById(
  id: string,
): Promise<CalibrationVehicleRow | null> {
  if (isMemoryBackend()) {
    return getMemoryVehicleById(id);
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `select ${ROW_SELECT}
     from public.calibration_vehicles
     where id = $1`,
    [id],
  );
  return firstRow(res);
}

type StepPatch = { step_index: number };
type CompletePatch = { is_completed: true; completed_at?: Date };

export async function updateCalibrationVehicleStep(
  id: string,
  patch: StepPatch | CompletePatch,
): Promise<CalibrationVehicleRow | null> {
  if (isMemoryBackend()) {
    return updateMemoryStep(id, patch);
  }

  const pool = getPool();
  if ("is_completed" in patch && patch.is_completed === true) {
    const res = await pool.query<Record<string, unknown>>(
      `update public.calibration_vehicles
       set is_completed = true,
           completed_at = $2
       where id = $1
       returning ${ROW_SELECT}`,
      [id, (patch.completed_at ?? new Date()).toISOString()],
    );
    return firstRow(res);
  }

  if ("step_index" in patch && typeof patch.step_index === "number") {
    const res = await pool.query<Record<string, unknown>>(
      `update public.calibration_vehicles
       set step_index = $2
       where id = $1
       returning ${ROW_SELECT}`,
      [id, patch.step_index],
    );
    return firstRow(res);
  }

  return getCalibrationVehicleById(id);
}

export async function deleteCalibrationVehicle(id: string): Promise<boolean> {
  if (isMemoryBackend()) {
    return deleteMemoryVehicle(id);
  }

  const pool = getPool();
  const res = await pool.query(`delete from public.calibration_vehicles where id = $1`, [id]);
  return res.rowCount != null && res.rowCount > 0;
}

export async function deleteCompletedCalibrationVehicles(): Promise<number> {
  if (isMemoryBackend()) {
    return deleteMemoryCompletedVehicles();
  }

  const pool = getPool();
  const res = await pool.query(`delete from public.calibration_vehicles where is_completed = true`);
  return res.rowCount ?? 0;
}

export async function updateCalibrationVehicleStepLink(
  id: string,
  stepIndex: number,
  url: string,
): Promise<CalibrationVehicleRow | null> {
  const key = String(stepIndex);
  const trimmed = url.trim();

  if (isMemoryBackend()) {
    return updateMemoryVehicleStepLink(id, stepIndex, trimmed);
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `update public.calibration_vehicles
     set step_links = case
       when $3::text = '' then coalesce(step_links, '{}'::jsonb) - $2::text
       else jsonb_set(coalesce(step_links, '{}'::jsonb), array[$2::text], to_jsonb($3::text), true)
     end
     where id = $1
     returning ${ROW_SELECT}`,
    [id, key, trimmed],
  );
  return firstRow(res);
}

export async function updateCalibrationVehicleOwner(
  id: string,
  owner: string,
): Promise<CalibrationVehicleRow | null> {
  const trimmed = owner.trim();
  if (isMemoryBackend()) {
    return updateMemoryVehicleOwner(id, trimmed);
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `update public.calibration_vehicles
     set owner = $2
     where id = $1
     returning ${ROW_SELECT}`,
    [id, trimmed],
  );
  return firstRow(res);
}
