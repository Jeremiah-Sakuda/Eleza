import { NextResponse } from "next/server";
import { z } from "zod";
import { claimGraphSchema } from "@/lib/claim-graph";
import { createPublicVivaSession, nextDailyRetryAt } from "@/lib/rate-limit";
import { hasValidJudgeAccessCode } from "@/lib/judge-access";

const inputSchema = z.object({
  graph: claimGraphSchema,
  submissionId: z.string().uuid().optional(),
  sourceText: z.string().min(1),
  title: z.string().min(1).max(300),
  durationMs: z.number().int().positive().optional(),
  sessionKind: z.enum(["judge", "practice"]).optional(),
  judgeAccessCode: z.string().min(1).max(256).optional(),
});

export async function POST(request: Request) {
  try {
    const input = inputSchema.parse(await request.json());
    const judgeAccess = input.judgeAccessCode === undefined ? false : hasValidJudgeAccessCode(input.judgeAccessCode);
    if (input.judgeAccessCode !== undefined && !judgeAccess) {
      return NextResponse.json({ error: "Judge access code was not accepted." }, { status: 403 });
    }
    const result = await createPublicVivaSession({
      request,
      graph: input.graph,
      sourceText: input.sourceText,
      title: input.title,
      submissionId: input.submissionId,
      durationMs: input.durationMs,
      sessionKind: input.sessionKind,
      judgeAccess,
    });
    if (!result.allowed) {
      const retryAt = nextDailyRetryAt();
      return NextResponse.json({
        error: result.reason === "ip_daily_cap"
          ? `Daily limit reached for this connection. Try again after ${retryAt}.`
          : result.reason === "judge_daily_cap"
            ? `Daily judge-access capacity reached. Try again after ${retryAt}.`
            : `Daily demo capacity reached. Try again after ${retryAt}.`,
        code: result.reason,
        retryAt,
      }, { status: 429, headers: { "Retry-After": "86400" } });
    }
    return NextResponse.json({ id: result.viva_session_id, durationLimitMs: result.applied_duration_limit_ms });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create viva session." }, { status: 422 });
  }
}
