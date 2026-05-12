import { NextResponse } from "next/server";
import { deleteCompletedCalibrationVehicles } from "@/lib/calibration-db";
import { requireAdminResponse } from "@/lib/admin-route";

export async function DELETE() {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  try {
    const removed = await deleteCompletedCalibrationVehicles();
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
