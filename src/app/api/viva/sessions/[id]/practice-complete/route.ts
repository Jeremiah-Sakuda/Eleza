import { NextResponse } from "next/server";
import { z } from "zod";
import { closePracticeSession } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    z.string().uuid().parse(id);
    await closePracticeSession(request, id);
    return NextResponse.json({ complete: true, recorded: false });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not close practice session." }, { status: 422 });
  }
}
