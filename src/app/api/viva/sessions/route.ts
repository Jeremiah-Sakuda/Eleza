import { NextResponse } from "next/server";
import { z } from "zod";
import { claimGraphSchema } from "@/lib/claim-graph";
import { createVivaSession } from "@/lib/decision-log";
import { claimDemoSession } from "@/lib/rate-limit";

const inputSchema = z.object({
  graph: claimGraphSchema,
  submissionId: z.string().uuid().optional(),
  sourceText: z.string().min(1),
  title: z.string().min(1).max(300),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const limit = await claimDemoSession(request);
    if (!limit.allowed) {
      return NextResponse.json({
        error: limit.reason === "ip_daily_cap"
          ? "This device has reached today’s five-session demo limit. Please return tomorrow."
          : "Today’s public demo capacity has been reached. Please return tomorrow.",
        code: limit.reason,
      }, { status: 429, headers: { "Retry-After": "86400" } });
    }
    return NextResponse.json(await createVivaSession(
      input.graph,
      input.submissionId,
      input.sourceText,
      input.title,
    ));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create viva session." }, { status: 422 });
  }
}
