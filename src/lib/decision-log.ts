import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { claimGraphSchema, type ClaimGraph } from "@/lib/claim-graph";
import type { ExaminerResult } from "@/lib/examiner";
import { examinerDecisionSchema } from "@/lib/examiner-schema";

export const decisionLogEntrySchema = examinerDecisionSchema.extend({
  id: z.string().uuid(),
  viva_session_id: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  transcript_segment: z.string().min(1),
  answered_at_ms: z.number().int().nonnegative(),
  created_at: z.string(),
});

export type DecisionLogEntry = z.infer<typeof decisionLogEntrySchema>;

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is required for live vivas. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function createVivaSession(
  graph: ClaimGraph,
  submissionId?: string,
  sourceText?: string,
  title?: string,
) {
  const supabase = serviceClient();
  const payload = {
    graph: claimGraphSchema.parse(graph),
    submission_id: submissionId || null,
    source_text: sourceText || null,
    title: title || null,
    status: "live",
  };
  const result = await supabase.from("viva_sessions").insert(payload).select("id, created_at").single();
  if (result.error) throw new Error(`Could not create viva session: ${result.error.message}`);
  return result.data as { id: string; created_at: string };
}

export async function appendDecisionLog(args: {
  sessionId: string;
  sequence: number;
  transcriptSegment: string;
  answeredAtMs: number;
  decision: ExaminerResult;
}) {
  const supabase = serviceClient();
  const decision = examinerDecisionSchema.parse(args.decision);
  const result = await supabase.from("decision_log").insert({
    viva_session_id: args.sessionId,
    sequence: args.sequence,
    transcript_segment: args.transcriptSegment,
    answered_at_ms: args.answeredAtMs,
    ...decision,
  }).select("*").single();
  if (result.error) throw new Error(`Could not append examiner decision: ${result.error.message}`);
  return decisionLogEntrySchema.parse(result.data);
}

export async function completeVivaSession(sessionId: string) {
  const result = await serviceClient().from("viva_sessions")
    .update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", sessionId);
  if (result.error) throw new Error(`Could not complete viva session: ${result.error.message}`);
}
