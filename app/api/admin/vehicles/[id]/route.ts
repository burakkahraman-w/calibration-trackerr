import { NextResponse } from "next/server";
import {
  deleteCalibrationVehicle,
  updateCalibrationVehicleOwner,
} from "@/lib/calibration-db";
import { requireAdminResponse } from "@/lib/admin-route";

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

  const owner =
    typeof body === "object" && body !== null && "owner" in body
      ? String((body as { owner: unknown }).owner).trim()
      : "";

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
