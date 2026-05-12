import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/admin-route";
import {
  insertWorkflowStep,
  listWorkflowSteps,
  workflowStepsArePersisted,
} from "@/lib/workflow-steps-db";

export async function GET() {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  try {
    const steps = await listWorkflowSteps();
    const persisted = await workflowStepsArePersisted();
    return NextResponse.json({ steps, persisted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof body === "object" && body !== null && "title" in body
      ? String((body as { title: unknown }).title)
      : "";

  try {
    const persisted = await workflowStepsArePersisted();
    if (!persisted) {
      return NextResponse.json(
        { error: "Workflow steps table is not installed yet." },
        { status: 400 },
      );
    }
    const step = await insertWorkflowStep(title);
    const steps = await listWorkflowSteps();
    return NextResponse.json({ step, steps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
