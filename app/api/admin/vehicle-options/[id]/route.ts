import { NextResponse } from "next/server";
import { deleteVehicleOption } from "@/lib/vehicle-options-db";
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
    const removed = await deleteVehicleOption(id);
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
