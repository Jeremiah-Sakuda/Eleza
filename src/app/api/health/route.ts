import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/decision-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await serviceClient().from("viva_sessions").select("id").limit(1);
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ status: "ok", database: "reachable" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
