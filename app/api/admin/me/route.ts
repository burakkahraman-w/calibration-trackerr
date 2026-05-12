import { NextResponse } from "next/server";
import { adminPasswordConfigured, isAdminAuthenticated } from "@/lib/admin-session";

export async function GET() {
  return NextResponse.json({
    authenticated: await isAdminAuthenticated(),
    configured: adminPasswordConfigured(),
  });
}
