import { NextResponse } from "next/server";
import { insertOwnerOption, listOwnerRows } from "@/lib/owner-options-db";
import { requireAdminResponse } from "@/lib/admin-route";

export async function GET() {
  const deny = await requireAdminResponse();
  if (deny) return deny;

  try {
    const owners = await listOwnerRows();
    return NextResponse.json({ owners });
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

  const name =
    typeof body === "object" && body !== null && "name" in body
      ? String((body as { name: unknown }).name).trim()
      : "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const owner = await insertOwnerOption(name);
    return NextResponse.json({ owner });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    if (/already exists|unique/i.test(message)) {
      return NextResponse.json({ error: "Owner already exists" }, { status: 409 });
    }
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
