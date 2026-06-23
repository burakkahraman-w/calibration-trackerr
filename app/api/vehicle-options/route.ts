import { NextResponse } from "next/server";
import { listVehicleOptions } from "@/lib/vehicle-options-db";

export async function GET() {
  try {
    const vehicles = await listVehicleOptions();
    return NextResponse.json({ vehicles });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = message.includes("DATABASE_URL") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
