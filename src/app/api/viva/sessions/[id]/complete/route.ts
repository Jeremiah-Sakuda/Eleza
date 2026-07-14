import { NextResponse } from "next/server";
import { z } from "zod";
import { completeVivaSession } from "@/lib/decision-log";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    z.string().uuid().parse(id);
    await completeVivaSession(id);
    return NextResponse.json({ complete: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not complete viva session." }, { status: 422 });
  }
}
