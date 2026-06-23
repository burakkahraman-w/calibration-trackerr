import { NextResponse } from "next/server";
import {
  insertCalibrationVehicle,
  isMemoryBackend,
  listCalibrationVehicles,
} from "@/lib/calibration-db";
import { ensureVehicleOption } from "@/lib/vehicle-options-db";
import { listLinkOptions } from "@/lib/link-options-db";
import { listWorkflowSteps } from "@/lib/workflow-steps-db";

export async function GET() {
  try {
    const vehicles = await listCalibrationVehicles();
    const steps = await listWorkflowSteps();
    const linkOptions = await listLinkOptions();
    return NextResponse.json({
      vehicles,
      steps,
      linkOptions,
      storageBackend: isMemoryBackend() ? "memory" : "postgres",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vehicle_name =
    typeof body === "object" && body !== null && "vehicle_name" in body
      ? String((body as { vehicle_name: unknown }).vehicle_name).trim()
      : "";
  const owner =
    typeof body === "object" && body !== null && "owner" in body
      ? String((body as { owner: unknown }).owner).trim()
      : "";
  const reason =
    typeof body === "object" && body !== null && "reason" in body
      ? String((body as { reason: unknown }).reason).trim()
      : "";
  const jira_ticket =
    typeof body === "object" && body !== null && "jira_ticket" in body
      ? String((body as { jira_ticket: unknown }).jira_ticket).trim()
      : "";
  const performed_at =
    typeof body === "object" && body !== null && "performed_at" in body
      ? String((body as { performed_at: unknown }).performed_at).trim()
      : "";

  if (!vehicle_name) {
    return NextResponse.json({ error: "vehicle_name is required" }, { status: 400 });
  }
  if (!owner) {
    return NextResponse.json({ error: "owner is required" }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }
  if (!jira_ticket) {
    return NextResponse.json({ error: "jira_ticket is required" }, { status: 400 });
  }
  if (!performed_at) {
    return NextResponse.json({ error: "performed_at is required" }, { status: 400 });
  }

  const performedDate = new Date(performed_at);
  if (Number.isNaN(performedDate.getTime())) {
    return NextResponse.json({ error: "performed_at must be a valid date/time" }, { status: 400 });
  }

  try {
    await ensureVehicleOption(vehicle_name);
    const vehicle = await insertCalibrationVehicle({
      vehicle_name,
      owner,
      reason,
      jira_ticket,
      performed_at: performedDate,
    });
    return NextResponse.json({ vehicle });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
