import { NextResponse } from "next/server";
import { requireAdminResponse } from "@/lib/admin-route";
import { setActiveCalibrationOwner } from "@/lib/calibration-settings-db";
import { listOwnerOptions } from "@/lib/owner-options-db";

export async function PATCH(request: Request) {
  const deny = await requireAdminResponse();
  if (deny) return deny;

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

  try {
    if (owner !== "") {
      const allowed = await listOwnerOptions();
      if (!allowed.includes(owner)) {
        return NextResponse.json(
          { error: "Owner must match one of the names in the owners list (add them under Owners first)." },
          { status: 400 },
        );
      }
    }
    const saved = await setActiveCalibrationOwner(owner);
    return NextResponse.json({ activeCalibrationOwner: saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
