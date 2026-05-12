import { NextResponse } from "next/server";
import { listWorkflowSteps } from "@/lib/workflow-steps-db";

export async function GET() {
  try {
    const steps = await listWorkflowSteps();
    return NextResponse.json({ steps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
