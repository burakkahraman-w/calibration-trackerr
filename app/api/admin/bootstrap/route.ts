import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/admin-route";
import { isMemoryBackend, listCalibrationVehicles } from "@/lib/calibration-db";
import { listOwnerRows } from "@/lib/owner-options-db";
import { listWorkflowSteps, workflowStepsArePersisted } from "@/lib/workflow-steps-db";

/** One admin page load → one lambda and fewer concurrent DB connections (Supabase session pooler). */
export async function GET() {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  try {
    const vehicles = await listCalibrationVehicles();
    const owners = await listOwnerRows();
    const steps = await listWorkflowSteps();
    const persisted = await workflowStepsArePersisted();
    return NextResponse.json({
      vehicles,
      owners,
      steps,
      persisted,
      storageBackend: isMemoryBackend() ? "memory" : "postgres",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
