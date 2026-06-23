import { NextResponse } from "next/server";
import {
  getCalibrationVehicleById,
  updateCalibrationVehicleOwner,
  updateCalibrationVehicleStep,
  updateCalibrationVehicleStepLink,
} from "@/lib/calibration-db";
import { isValidStepIndex } from "@/lib/workflow";
import { listWorkflowSteps } from "@/lib/workflow-steps-db";
import { isValidLinkIndex } from "@/lib/link-options-db";
import { listOwnerOptions } from "@/lib/owner-options-db";
import { appendAdminChangeLog, formatLogValue } from "@/lib/admin-change-log-db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const stepLink =
    "step_link" in body && typeof (body as { step_link: unknown }).step_link === "object"
      ? (body as { step_link: { step_index?: unknown; url?: unknown } }).step_link
      : null;

  if (stepLink) {
    const stepIndex = Number(stepLink.step_index);
    const url = typeof stepLink.url === "string" ? stepLink.url.trim() : "";
    if (!Number.isInteger(stepIndex) || stepIndex < 0) {
      return NextResponse.json({ error: "step_index must be a non-negative integer" }, { status: 400 });
    }

    try {
      if (!(await isValidLinkIndex(stepIndex))) {
        return NextResponse.json({ error: "Invalid link index" }, { status: 400 });
      }

      const row = await getCalibrationVehicleById(id);
      if (!row) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      if (row.is_completed) {
        return NextResponse.json({ error: "Vehicle already completed" }, { status: 400 });
      }

      const existing = row.step_links[String(stepIndex)] ?? "";
      if (existing && existing !== url) {
        return NextResponse.json(
          { error: "This step link was already saved. Ask an admin to change it." },
          { status: 403 },
        );
      }

      const updated = await updateCalibrationVehicleStepLink(id, stepIndex, url);
      return NextResponse.json({ vehicle: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Server error";
      const status = message.includes("DATABASE_URL") ? 503 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if ("owner" in body) {
    const owner = String((body as { owner: unknown }).owner).trim();
    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }

    try {
      const allowed = await listOwnerOptions();
      if (!allowed.includes(owner)) {
        return NextResponse.json({ error: "Select an owner from the list." }, { status: 400 });
      }

      const before = await getCalibrationVehicleById(id);
      if (!before) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      if (before.is_completed) {
        return NextResponse.json({ error: "Vehicle already completed" }, { status: 400 });
      }
      if (before.owner === owner) {
        return NextResponse.json({ vehicle: before });
      }

      const updated = await updateCalibrationVehicleOwner(id, owner);
      if (!updated) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }

      await appendAdminChangeLog(
        "tracker_owner_changed",
        `Owner for ${updated.vehicle_name}: ${formatLogValue(before.owner)} → ${formatLogValue(updated.owner)}.`,
      );

      return NextResponse.json({ vehicle: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Server error";
      const status = message.includes("DATABASE_URL") ? 503 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  const direction =
    "direction" in body ? String((body as { direction: unknown }).direction) : "";

  if (direction !== "next" && direction !== "back") {
    return NextResponse.json(
      { error: "Provide owner, step_link, or direction (next/back)." },
      { status: 400 },
    );
  }

  try {
    const steps = await listWorkflowSteps();
    const n = steps.length;
    if (n === 0) {
      return NextResponse.json({ error: "No calibration steps configured" }, { status: 500 });
    }

    const row = await getCalibrationVehicleById(id);

    if (!row) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (row.is_completed) {
      return NextResponse.json({ error: "Vehicle already completed" }, { status: 400 });
    }

    let step = row.step_index as number;
    if (!isValidStepIndex(n, step)) {
      return NextResponse.json({ error: "Invalid stored step" }, { status: 500 });
    }

    if (direction === "back") {
      if (step <= 0) {
        return NextResponse.json({ error: "Cannot go back from first step" }, { status: 400 });
      }
      step -= 1;
      const updated = await updateCalibrationVehicleStep(id, { step_index: step });
      return NextResponse.json({ vehicle: updated });
    }

    if (step >= n - 1) {
      const updated = await updateCalibrationVehicleStep(id, {
        is_completed: true,
        completed_at: new Date(),
      });
      return NextResponse.json({ vehicle: updated });
    }

    step += 1;
    const updated = await updateCalibrationVehicleStep(id, { step_index: step });
    return NextResponse.json({ vehicle: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
