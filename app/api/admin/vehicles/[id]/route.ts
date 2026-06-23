import { NextResponse } from "next/server";
import {
  deleteCalibrationVehicle,
  updateCalibrationVehicleOwner,
  updateCalibrationVehicleStepLink,
} from "@/lib/calibration-db";
import { requireAdminResponse } from "@/lib/admin-route";
import { isValidLinkIndex } from "@/lib/link-options-db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Params) {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const removed = await deleteCalibrationVehicle(id);
    if (!removed) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, context: Params) {
  const deny = await requireAdminResponse();
  if (deny) return deny;

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

  const owner =
    "owner" in body ? String((body as { owner: unknown }).owner).trim() : "";

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
      const updated = await updateCalibrationVehicleStepLink(id, stepIndex, url);
      if (!updated) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      return NextResponse.json({ vehicle: updated });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Server error";
      const status = message.includes("DATABASE_URL") ? 503 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  if (!owner) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }

  try {
    const row = await updateCalibrationVehicleOwner(id, owner);
    if (!row) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    return NextResponse.json({ vehicle: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
