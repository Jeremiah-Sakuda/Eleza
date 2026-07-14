import { NextResponse } from "next/server";
import { z } from "zod";
import { appendDecisionLog } from "@/lib/decision-log";
import { examineAnswer, examinerInputSchema } from "@/lib/examiner";

const inputSchema = examinerInputSchema.extend({
  session_id: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  answered_at_ms: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const decision = await examineAnswer(input);
    if (decision.quality_gate.status !== "passed") {
      throw new Error("Examiner rationale failed the receipt gate after all retries; no routing decision was emitted.");
    }
    // DECISION: persistence succeeds before the decision reaches the UI, so the pane never becomes parallel state.
    const entry = await appendDecisionLog({
      sessionId: input.session_id,
      sequence: input.sequence,
      transcriptSegment: input.transcript_segment,
      answeredAtMs: input.answered_at_ms,
      decision,
    });
    return NextResponse.json({ entry, quality_gate: decision.quality_gate });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Examiner turn failed." }, { status: 422 });
  }
}
