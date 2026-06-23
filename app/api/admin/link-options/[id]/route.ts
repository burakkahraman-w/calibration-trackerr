import { NextResponse } from "next/server";
import { deleteLinkOption } from "@/lib/link-options-db";
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
    const removed = await deleteLinkOption(id);
    if (!removed) {
      return NextResponse.json({ error: "Link name not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("At least one") ? 400 : message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
