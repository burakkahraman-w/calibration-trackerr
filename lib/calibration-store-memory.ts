import { randomUUID } from "crypto";
import type { CalibrationVehicleRow } from "@/lib/types";

const GLOBAL_KEY = "__calibration_tracker_memory__" as const;

type StepPatch = { step_index: number };
type CompletePatch = { is_completed: true; completed_at?: Date };

function getMap(): Map<string, CalibrationVehicleRow> {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: Map<string, CalibrationVehicleRow>;
  };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new Map();
  }
  return g[GLOBAL_KEY];
}

export function isMemoryBackend(): boolean {
  return !process.env.DATABASE_URL?.trim();
}

export async function listMemoryVehicles(): Promise<CalibrationVehicleRow[]> {
  const rows = Array.from(getMap().values()).map((r) => ({
    ...r,
    owner: r.owner ?? "",
  }));
  rows.sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
  return rows;
}

export async function insertMemoryVehicle(input: {
  vehicle_name: string;
  owner: string;
  performed_at: Date;
}): Promise<CalibrationVehicleRow> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const row: CalibrationVehicleRow = {
    id,
    vehicle_name: input.vehicle_name,
    owner: input.owner,
    performed_at: input.performed_at.toISOString(),
    step_index: 0,
    is_completed: false,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
  getMap().set(id, row);
  return row;
}

export async function getMemoryVehicleById(id: string): Promise<CalibrationVehicleRow | null> {
  return getMap().get(id) ?? null;
}

export async function updateMemoryVehicleStep(
  id: string,
  patch: StepPatch | CompletePatch,
): Promise<CalibrationVehicleRow | null> {
  const map = getMap();
  const current = map.get(id);
  if (!current) return null;

  if ("is_completed" in patch && patch.is_completed === true) {
    const completedAt = (patch.completed_at ?? new Date()).toISOString();
    const updated: CalibrationVehicleRow = {
      ...current,
      is_completed: true,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    };
    map.set(id, updated);
    return updated;
  }

  if ("step_index" in patch && typeof patch.step_index === "number") {
    const updated: CalibrationVehicleRow = {
      ...current,
      step_index: patch.step_index,
      updated_at: new Date().toISOString(),
    };
    map.set(id, updated);
    return updated;
  }

  return current;
}

export async function deleteMemoryVehicle(id: string): Promise<boolean> {
  return getMap().delete(id);
}

export async function deleteMemoryCompletedVehicles(): Promise<number> {
  const map = getMap();
  let n = 0;
  for (const [id, row] of map) {
    if (row.is_completed) {
      map.delete(id);
      n += 1;
    }
  }
  return n;
}

export async function updateMemoryVehicleOwner(
  id: string,
  owner: string,
): Promise<CalibrationVehicleRow | null> {
  const map = getMap();
  const current = map.get(id);
  if (!current) return null;
  const updated: CalibrationVehicleRow = {
    ...current,
    owner,
    updated_at: new Date().toISOString(),
  };
  map.set(id, updated);
  return updated;
}
