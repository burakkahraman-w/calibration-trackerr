import { NextResponse } from "next/server";
import { listLinkOptions } from "@/lib/link-options-db";

export async function GET() {
  try {
    const links = await listLinkOptions();
    return NextResponse.json({ links });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
