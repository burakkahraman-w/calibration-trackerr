import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-session";

export async function requireAdminResponse(): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
