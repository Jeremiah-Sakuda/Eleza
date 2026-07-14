import { z } from "zod";
import { claimGraphSchema, type ClaimGraph } from "@/lib/claim-graph";
import { decisionLogEntrySchema, serviceClient, type DecisionLogEntry } from "@/lib/decision-log";
import { analyzeDivergence, transcriptTurnSchema, type TranscriptTurnInput } from "@/lib/divergence";
import { divergenceAnalysisSchema, type DivergenceAnalysis } from "@/lib/divergence-schema";

const persistedTurnSchema = z.object({
  id: z.string().uuid(),
  viva_session_id: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  speaker: z.enum(["examiner", "student"]),
  text: z.string().min(1),
  elapsed_ms: z.number().int().nonnegative(),
  target_claim_id: z.string().nullable(),
  question_kind: z.enum(["opening", "bridge", "adaptive"]).nullable(),
  created_at: z.string(),
});

export type PersistedTranscriptTurn = z.infer<typeof persistedTurnSchema>;

export type Dossier = {
  id: string;
  sessionId: string;
  title: string;
  sourceText: string;
  graph: ClaimGraph;
  transcript: PersistedTranscriptTurn[];
  decisionLog: DecisionLogEntry[];
  analysis: DivergenceAnalysis;
  createdAt: string;
  completedAt: string | null;
  durationMs: number;
};

export type TriageRow = {
  dossierId: string;
  studentLabel: string;
  title: string;
  durationMs: number;
  findingCount: number;
  completedAt: string;
};

export async function persistTranscript(sessionId: string, rawTurns: TranscriptTurnInput[]) {
  const turns = z.array(transcriptTurnSchema).parse(rawTurns);
  if (turns.length === 0) throw new Error("A completed viva must contain transcript turns.");
  const rows = turns.map((turn, sequence) => ({
    viva_session_id: sessionId,
    sequence,
    speaker: turn.speaker,
    text: turn.text,
    elapsed_ms: turn.elapsedMs,
    target_claim_id: turn.targetClaimId ?? null,
    question_kind: turn.questionKind ?? null,
  }));
  // DECISION: ignore duplicate sequence receipts so a failed dossier request can be retried without rewriting the original transcript.
  const result = await serviceClient().from("transcript_turns")
    .upsert(rows, { onConflict: "viva_session_id,sequence", ignoreDuplicates: true });
  if (result.error) throw new Error(`Could not persist viva transcript: ${result.error.message}`);
}

export async function generateAndPersistDossier(sessionId: string) {
  const supabase = serviceClient();
  const existing = await supabase.from("dossiers").select("id").eq("viva_session_id", sessionId).maybeSingle();
  if (existing.error) throw new Error(`Could not check dossier state: ${existing.error.message}`);
  if (existing.data) return { id: existing.data.id as string, existing: true };

  const [sessionResult, transcriptResult, logResult] = await Promise.all([
    supabase.from("viva_sessions").select("graph, source_text").eq("id", sessionId).single(),
    supabase.from("transcript_turns").select("*").eq("viva_session_id", sessionId).order("sequence"),
    supabase.from("decision_log").select("*").eq("viva_session_id", sessionId).order("sequence"),
  ]);
  if (sessionResult.error) throw new Error(`Could not load viva evidence: ${sessionResult.error.message}`);
  if (transcriptResult.error) throw new Error(`Could not load viva transcript: ${transcriptResult.error.message}`);
  if (logResult.error) throw new Error(`Could not load decision log: ${logResult.error.message}`);

  const sourceText = z.string().min(1).parse(sessionResult.data.source_text);
  const graph = claimGraphSchema.parse(sessionResult.data.graph);
  const transcriptRows = z.array(persistedTurnSchema).parse(transcriptResult.data);
  const transcript = transcriptRows.map((turn) => transcriptTurnSchema.parse({
    id: turn.id,
    speaker: turn.speaker,
    text: turn.text,
    elapsedMs: turn.elapsed_ms,
    targetClaimId: turn.target_claim_id ?? undefined,
    questionKind: turn.question_kind ?? undefined,
  }));
  const decisionLog = z.array(decisionLogEntrySchema).parse(logResult.data);
  const result = await analyzeDivergence({ source_text: sourceText, graph, transcript, decision_log: decisionLog });

  const saved = await supabase.from("dossiers").insert({
    viva_session_id: sessionId,
    prompt_version: "divergence-v1",
    analysis: result.analysis,
    analysis_attempts: result.attempts,
  }).select("id").single();
  if (saved.error) throw new Error(`Could not save dossier: ${saved.error.message}`);
  return { id: saved.data.id as string, existing: false };
}

export async function loadDossier(id: string): Promise<Dossier> {
  const supabase = serviceClient();
  const dossierResult = await supabase.from("dossiers")
    .select("id, viva_session_id, analysis, created_at")
    .eq("id", id)
    .single();
  if (dossierResult.error) throw new Error(`Could not load dossier: ${dossierResult.error.message}`);
  const sessionId = z.string().uuid().parse(dossierResult.data.viva_session_id);
  const [sessionResult, transcriptResult, logResult] = await Promise.all([
    supabase.from("viva_sessions").select("title, source_text, graph, completed_at").eq("id", sessionId).single(),
    supabase.from("transcript_turns").select("*").eq("viva_session_id", sessionId).order("sequence"),
    supabase.from("decision_log").select("*").eq("viva_session_id", sessionId).order("sequence"),
  ]);
  if (sessionResult.error) throw new Error(`Could not load dossier session: ${sessionResult.error.message}`);
  if (transcriptResult.error) throw new Error(`Could not load dossier transcript: ${transcriptResult.error.message}`);
  if (logResult.error) throw new Error(`Could not load dossier decision log: ${logResult.error.message}`);
  const transcript = z.array(persistedTurnSchema).parse(transcriptResult.data);
  return {
    id: z.string().uuid().parse(dossierResult.data.id),
    sessionId,
    title: z.string().nullable().parse(sessionResult.data.title) ?? "Argumentative submission",
    sourceText: z.string().min(1).parse(sessionResult.data.source_text),
    graph: claimGraphSchema.parse(sessionResult.data.graph),
    transcript,
    decisionLog: z.array(decisionLogEntrySchema).parse(logResult.data),
    analysis: divergenceAnalysisSchema.parse(dossierResult.data.analysis),
    createdAt: z.string().parse(dossierResult.data.created_at),
    completedAt: z.string().nullable().parse(sessionResult.data.completed_at),
    durationMs: transcript.reduce((maximum, turn) => Math.max(maximum, turn.elapsed_ms), 0),
  };
}

export async function listDossierTriage(): Promise<TriageRow[]> {
  const supabase = serviceClient();
  const dossiers = await supabase.from("dossiers")
    .select("id, viva_session_id, analysis, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (dossiers.error) throw new Error(`Could not load dossier triage: ${dossiers.error.message}`);
  if (!dossiers.data.length) return [];
  const sessionIds = dossiers.data.map((row) => z.string().uuid().parse(row.viva_session_id));
  const [sessions, turns] = await Promise.all([
    supabase.from("viva_sessions").select("id, title, completed_at").in("id", sessionIds),
    supabase.from("transcript_turns").select("viva_session_id, elapsed_ms").in("viva_session_id", sessionIds),
  ]);
  if (sessions.error) throw new Error(`Could not load triage sessions: ${sessions.error.message}`);
  if (turns.error) throw new Error(`Could not load triage durations: ${turns.error.message}`);
  const sessionMap = new Map(sessions.data.map((session) => [session.id as string, session]));
  const durations = new Map<string, number>();
  for (const turn of turns.data) {
    const sessionId = z.string().uuid().parse(turn.viva_session_id);
    durations.set(sessionId, Math.max(durations.get(sessionId) ?? 0, z.number().int().nonnegative().parse(turn.elapsed_ms)));
  }
  return dossiers.data.map((row) => {
    const sessionId = z.string().uuid().parse(row.viva_session_id);
    const session = sessionMap.get(sessionId);
    const analysis = divergenceAnalysisSchema.parse(row.analysis);
    return {
      dossierId: z.string().uuid().parse(row.id),
      studentLabel: `V-${sessionId.slice(0, 4).toUpperCase()}`,
      title: z.string().nullable().parse(session?.title ?? null) ?? "Argumentative submission",
      durationMs: durations.get(sessionId) ?? 0,
      findingCount: analysis.findings.length,
      completedAt: z.string().nullable().parse(session?.completed_at ?? null) ?? z.string().parse(row.created_at),
    };
  }).sort((a, b) => b.findingCount - a.findingCount || b.completedAt.localeCompare(a.completedAt));
}
