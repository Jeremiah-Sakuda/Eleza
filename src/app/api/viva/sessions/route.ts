import { NextResponse } from "next/server";
import { z } from "zod";
import { claimGraphSchema } from "@/lib/claim-graph";
import { createVivaSession } from "@/lib/decision-log";

const inputSchema = z.object({
  graph: claimGraphSchema,
  submissionId: z.string().uuid().optional(),
  sourceText: z.string().min(1),
  title: z.string().min(1).max(300),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
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
