import { NextResponse } from "next/server";
import { listOwnerOptions } from "@/lib/owner-options-db";

export async function GET() {
  try {
    const owners = await listOwnerOptions();
    return NextResponse.json({ owners });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
