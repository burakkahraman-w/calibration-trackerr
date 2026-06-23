import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/admin-route";
import { listTrackerOwnerChangeLogs } from "@/lib/admin-change-log-db";
import { getActiveCalibrationOwner } from "@/lib/calibration-settings-db";
import { isMemoryBackend, listCalibrationVehicles } from "@/lib/calibration-db";
import { listOwnerRows } from "@/lib/owner-options-db";
import { listVehicleRows } from "@/lib/vehicle-options-db";
import { listWorkflowSteps, workflowStepsArePersisted } from "@/lib/workflow-steps-db";

/** One admin page load → one lambda and fewer concurrent DB connections (Supabase session pooler). */
export async function GET() {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  try {
    const vehicles = await listCalibrationVehicles();
    const owners = await listOwnerRows();
    const vehicleOptions = await listVehicleRows();
    const activeCalibrationOwner = await getActiveCalibrationOwner();
    const steps = await listWorkflowSteps();
    const persisted = await workflowStepsArePersisted();
    const changeLog = await listTrackerOwnerChangeLogs();
    return NextResponse.json({
      vehicles,
      owners,
      vehicleOptions,
      activeCalibrationOwner,
      steps,
      persisted,
      changeLog,
      storageBackend: isMemoryBackend() ? "memory" : "postgres",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
