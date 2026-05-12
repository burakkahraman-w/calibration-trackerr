import { NextResponse } from "next/server";
import {
  getCalibrationVehicleById,
  updateCalibrationVehicleStep,
} from "@/lib/calibration-db";
import { CALIBRATION_STEPS, type StepIndex } from "@/lib/workflow";

type Params = { params: Promise<{ id: string }> };

function isStepIndex(n: number): n is StepIndex {
  return Number.isInteger(n) && n >= 0 && n < CALIBRATION_STEPS.length;
}

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

  const direction =
    typeof body === "object" && body !== null && "direction" in body
      ? String((body as { direction: unknown }).direction)
      : "";

  if (direction !== "next" && direction !== "back") {
    return NextResponse.json({ error: "direction must be next or back" }, { status: 400 });
  }

  try {
    const row = await getCalibrationVehicleById(id);

    if (!row) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    if (row.is_completed) {
      return NextResponse.json({ error: "Vehicle already completed" }, { status: 400 });
    }

    let step = row.step_index as number;
    if (!isStepIndex(step)) {
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

    if (step >= CALIBRATION_STEPS.length - 1) {
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
