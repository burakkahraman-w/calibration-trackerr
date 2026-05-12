import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/admin-route";
import {
  deleteWorkflowStep,
  listWorkflowSteps,
  moveWorkflowStep,
  updateWorkflowStepTitle,
  workflowStepsArePersisted,
} from "@/lib/workflow-steps-db";

type Params = { params: Promise<{ id: string }> };

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

  const persisted = await workflowStepsArePersisted();
  if (!persisted) {
    return NextResponse.json(
      { error: "Workflow steps table is not installed yet." },
      { status: 400 },
    );
  }

  try {
    if (typeof body === "object" && body !== null && "move" in body) {
      const move = String((body as { move: unknown }).move);
      if (move !== "up" && move !== "down") {
        return NextResponse.json({ error: "move must be up or down" }, { status: 400 });
      }
      const steps = await moveWorkflowStep(id, move);
      if (!steps) {
        return NextResponse.json({ error: "Step not found" }, { status: 404 });
      }
      return NextResponse.json({ steps });
    }

    const title =
      typeof body === "object" && body !== null && "title" in body
        ? String((body as { title: unknown }).title)
        : "";
    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const step = await updateWorkflowStepTitle(id, title);
    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }
    const steps = await listWorkflowSteps();
    return NextResponse.json({ step, steps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: Params) {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const persisted = await workflowStepsArePersisted();
  if (!persisted) {
    return NextResponse.json(
      { error: "Workflow steps table is not installed yet." },
      { status: 400 },
    );
  }

  try {
    const ok = await deleteWorkflowStep(id);
    if (!ok) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }
    const steps = await listWorkflowSteps();
    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status =
      message.includes("At least one calibration") || message.includes("Run db/migrations")
        ? 400
        : message.includes("DATABASE_URL")
          ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
