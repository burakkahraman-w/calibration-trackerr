import { randomUUID } from "crypto";
import { getPool } from "@/lib/db";
import { DEFAULT_CALIBRATION_STEPS } from "@/lib/workflow";
import { stepTitleHasLinkField } from "@/lib/step-links-config";
import { isMemoryBackend } from "@/lib/calibration-store-memory";

export type WorkflowStepRow = {
  id: string;
  title: string;
  position: number;
  /** When true, the public tracker shows a collapsible link field for this step. */
  link_enabled: boolean;
};

const GLOBAL_STEPS = "__calibration_tracker_workflow_steps__" as const;

const DEFAULT_ID_PREFIX = "__default__";

function defaultRows(): WorkflowStepRow[] {
  return DEFAULT_CALIBRATION_STEPS.map((title, position) => ({
    id: `${DEFAULT_ID_PREFIX}${position}`,
    title,
    position,
    link_enabled: stepTitleHasLinkField(title),
  }));
}

function isDefaultId(id: string): boolean {
  return id.startsWith(DEFAULT_ID_PREFIX);
}

function memorySteps(): WorkflowStepRow[] {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_STEPS]?: WorkflowStepRow[];
  };
  if (!g[GLOBAL_STEPS]) {
    g[GLOBAL_STEPS] = defaultRows().map((r) => ({ ...r, id: randomUUID() }));
  }
  return g[GLOBAL_STEPS];
}

function memorySortCopy(): WorkflowStepRow[] {
  return [...memorySteps()].sort((a, b) => a.position - b.position);
}

export function workflowStepsTableMissingMessage(): string {
  return "Run db/migrations/004_calibration_workflow_steps.sql on your database to edit steps.";
}

/** Short TTL so many concurrent lambdas share fewer identical reads (session pooler is tight on Vercel). */
const STEPS_CACHE_TTL_MS = 45_000;

type StepsCacheEntry = { at: number; steps: WorkflowStepRow[]; persisted: boolean };

let stepsCache: StepsCacheEntry | null = null;

export function invalidateWorkflowStepsCache(): void {
  stepsCache = null;
}

async function loadStepsAndPersisted(): Promise<{ steps: WorkflowStepRow[]; persisted: boolean }> {
  if (isMemoryBackend()) {
    return { steps: memorySortCopy(), persisted: true };
  }

  const now = Date.now();
  if (stepsCache && now - stepsCache.at < STEPS_CACHE_TTL_MS) {
    return { steps: stepsCache.steps, persisted: stepsCache.persisted };
  }

  const pool = getPool();
  try {
    const res = await pool.query<Record<string, unknown>>(
      `select id, title, position, coalesce(link_enabled, false) as link_enabled
       from public.calibration_workflow_steps
       order by position asc`,
    );
    const steps = res.rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      position: Number(r.position),
      link_enabled: Boolean(r.link_enabled),
    }));
    const out = { steps, persisted: true };
    stepsCache = { at: now, ...out };
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/link_enabled|column.*does not exist/i.test(msg)) {
      const res = await pool.query<Record<string, unknown>>(
        `select id, title, position
         from public.calibration_workflow_steps
         order by position asc`,
      );
      const steps = res.rows.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        position: Number(r.position),
        link_enabled: stepTitleHasLinkField(String(r.title)),
      }));
      const out = { steps, persisted: true };
      stepsCache = { at: now, ...out };
      return out;
    }
    if (!/calibration_workflow_steps|does not exist|undefined_table/i.test(msg)) throw e;
    const steps = defaultRows();
    const out = { steps, persisted: false };
    stepsCache = { at: now, ...out };
    return out;
  }
}

export async function listWorkflowSteps(): Promise<WorkflowStepRow[]> {
  return (await loadStepsAndPersisted()).steps;
}

export async function workflowStepsArePersisted(): Promise<boolean> {
  return (await loadStepsAndPersisted()).persisted;
}

export async function insertWorkflowStep(title: string): Promise<WorkflowStepRow> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("title is required");

  if (isMemoryBackend()) {
    const steps = memorySteps();
    const nextPos = steps.length === 0 ? 0 : Math.max(...steps.map((s) => s.position)) + 1;
    const row: WorkflowStepRow = { id: randomUUID(), title: trimmed, position: nextPos, link_enabled: stepTitleHasLinkField(trimmed) };
    steps.push(row);
    return row;
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `insert into public.calibration_workflow_steps (title, position)
     values ($1, (select coalesce(max(position), -1) + 1 from public.calibration_workflow_steps))
     returning id, title, position, coalesce(link_enabled, false) as link_enabled`,
    [trimmed],
  );
  const r = res.rows[0];
  if (!r) throw new Error("Insert returned no row");
  invalidateWorkflowStepsCache();
  return {
    id: String(r.id),
    title: String(r.title),
    position: Number(r.position),
    link_enabled: Boolean(r.link_enabled),
  };
}

export async function updateWorkflowStepTitle(id: string, title: string): Promise<WorkflowStepRow | null> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("title is required");
  if (isDefaultId(id)) throw new Error(workflowStepsTableMissingMessage());

  if (isMemoryBackend()) {
    const steps = memorySteps();
    const row = steps.find((s) => s.id === id);
    if (!row) return null;
    row.title = trimmed;
    return { ...row };
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `update public.calibration_workflow_steps
     set title = $2
     where id = $1::uuid
     returning id, title, position, coalesce(link_enabled, false) as link_enabled`,
    [id, trimmed],
  );
  const r = res.rows[0];
  if (r) invalidateWorkflowStepsCache();
  return r ? { id: String(r.id), title: String(r.title), position: Number(r.position), link_enabled: Boolean(r.link_enabled) } : null;
}

export async function updateWorkflowStepLinkEnabled(
  id: string,
  linkEnabled: boolean,
): Promise<WorkflowStepRow | null> {
  if (isDefaultId(id)) throw new Error(workflowStepsTableMissingMessage());

  if (isMemoryBackend()) {
    const steps = memorySteps();
    const row = steps.find((s) => s.id === id);
    if (!row) return null;
    row.link_enabled = linkEnabled;
    return { ...row };
  }

  const pool = getPool();
  const res = await pool.query<Record<string, unknown>>(
    `update public.calibration_workflow_steps
     set link_enabled = $2
     where id = $1::uuid
     returning id, title, position, link_enabled`,
    [id, linkEnabled],
  );
  const r = res.rows[0];
  if (r) invalidateWorkflowStepsCache();
  return r
    ? {
        id: String(r.id),
        title: String(r.title),
        position: Number(r.position),
        link_enabled: Boolean(r.link_enabled),
      }
    : null;
}

export async function deleteWorkflowStep(id: string): Promise<boolean> {
  if (isDefaultId(id)) throw new Error(workflowStepsTableMissingMessage());

  if (isMemoryBackend()) {
    const steps = memorySteps();
    if (steps.length <= 1) {
      throw new Error("At least one calibration step is required.");
    }
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    steps.splice(idx, 1);
    steps
      .sort((a, b) => a.position - b.position)
      .forEach((s, i) => {
        s.position = i;
      });
    return true;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const cnt = await client.query<{ c: string }>(
      `select count(*)::text as c from public.calibration_workflow_steps`,
    );
    if (Number(cnt.rows[0]?.c ?? 0) <= 1) {
      await client.query("rollback");
      throw new Error("At least one calibration step is required.");
    }
    const posRes = await client.query<{ position: number }>(
      `delete from public.calibration_workflow_steps where id = $1::uuid returning position`,
      [id],
    );
    if (posRes.rowCount === 0) {
      await client.query("rollback");
      return false;
    }
    const p = Number(posRes.rows[0]!.position);
    await client.query(
      `update public.calibration_workflow_steps set position = position - 1 where position > $1`,
      [p],
    );
    await client.query(
      `update public.calibration_vehicles
       set step_index = case when step_index > $1 then step_index - 1 else step_index end
       where is_completed = false`,
      [p],
    );
    await client.query(
      `update public.calibration_vehicles
       set step_index = least(step_index, (select coalesce(max(position), 0) from public.calibration_workflow_steps))
       where is_completed = false`,
    );
    await client.query("commit");
    invalidateWorkflowStepsCache();
    return true;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

export async function moveWorkflowStep(id: string, direction: "up" | "down"): Promise<WorkflowStepRow[] | null> {
  if (isDefaultId(id)) throw new Error(workflowStepsTableMissingMessage());

  if (isMemoryBackend()) {
    const steps = memorySteps().sort((a, b) => a.position - b.position);
    const i = steps.findIndex((s) => s.id === id);
    if (i === -1) return null;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= steps.length) return memorySortCopy();
    const a = steps[i]!;
    const b = steps[j]!;
    const tmp = a.position;
    a.position = b.position;
    b.position = tmp;
    return memorySortCopy();
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const cur = await client.query<{ position: number }>(
      `select position from public.calibration_workflow_steps where id = $1::uuid for update`,
      [id],
    );
    if (cur.rowCount === 0) {
      await client.query("rollback");
      return null;
    }
    const p = cur.rows[0]!.position;
    const neighborPos = direction === "up" ? p - 1 : p + 1;
    const neighbor = await client.query<{ id: string }>(
      `select id::text as id from public.calibration_workflow_steps where position = $1 for update`,
      [neighborPos],
    );
    if (neighbor.rowCount === 0) {
      await client.query("commit");
      return listWorkflowSteps();
    }
    const nid = neighbor.rows[0]!.id;
    await client.query(
      `update public.calibration_workflow_steps set position = case when id = $1::uuid then $2::int when id = $3::uuid then $4::int else position end
       where id in ($1::uuid, $3::uuid)`,
      [id, neighborPos, nid, p],
    );
    await client.query("commit");
    invalidateWorkflowStepsCache();
    return listWorkflowSteps();
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
