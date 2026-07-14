import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimGraph } from "@/lib/claim-graph";
import { appendDecisionLog, completeVivaSession, createVivaSession, type DecisionLogEntry } from "@/lib/decision-log";
import { analyzeDivergence, type DivergenceInput } from "@/lib/divergence";
import { generateAndPersistDossier, loadDossier, persistTranscript } from "@/lib/dossier-store";

type Fixture = {
  title: string;
  claims: Array<{ id: string; paragraph_prefix: string; label: string }>;
  answers: Array<{ claim_id: string; timestamp: number; question: string; answer: string; assessment: DecisionLogEntry["assessment"] }>;
  expected_finding: { claim_id: string; type: "cannot_reconstruct" };
};

async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
  const sourceText = await readFile(path.join(process.cwd(), "fixtures/community-gardens-argument.txt"), "utf8");
  const fixture = JSON.parse(await readFile(path.join(process.cwd(), "fixtures/divergence/weak-viva.json"), "utf8")) as Fixture;
  const graph: ClaimGraph = {
    nodes: fixture.claims.map((claim) => {
      const start = sourceText.indexOf(claim.paragraph_prefix);
      assert.ok(start >= 0, `${claim.id} prefix is missing from the fixture.`);
      const breakAt = sourceText.indexOf("\n", start);
      return { id: claim.id, type: "claim", label: claim.label, source_span: { start, end: breakAt === -1 ? sourceText.length : breakAt } };
    }),
    edges: [
      { source: "claim_food_access", target: "claim_relationships", type: "supports" },
      { source: "claim_relationships", target: "claim_resilience", type: "depends_on" },
    ],
  };
  const transcript: DivergenceInput["transcript"] = fixture.answers.flatMap((answer, index) => [
    { id: `q-${index}`, speaker: "examiner", text: answer.question, elapsedMs: answer.timestamp - 12_000, targetClaimId: answer.claim_id, questionKind: index === 0 ? "opening" : "adaptive" },
    { id: `a-${index}`, speaker: "student", text: answer.answer, elapsedMs: answer.timestamp, targetClaimId: answer.claim_id, questionKind: index === 0 ? "opening" : "adaptive" },
  ]);
  const decision_log: DecisionLogEntry[] = fixture.answers.map((answer, sequence) => ({
    id: `00000000-0000-4000-8000-${String(sequence + 1).padStart(12, "0")}`,
    viva_session_id: "10000000-0000-4000-8000-000000000000",
    sequence,
    transcript_segment: answer.answer,
    answered_at_ms: answer.timestamp,
    answer_summary: answer.assessment === "strong" ? "The answer reconstructs the claim." : "The answer cannot reconstruct the mechanism.",
    target_claim_id: answer.claim_id,
    assessment: answer.assessment,
    action: answer.assessment === "strong" ? "advance" : "probe",
    next_claim_id: answer.assessment === "strong" ? fixture.answers[Math.min(sequence + 1, fixture.answers.length - 1)].claim_id : answer.claim_id,
    next_question: answer.assessment === "strong" ? "Explain the next claim." : "Can you reconstruct the missing mechanism?",
    rationale: `${answer.claim_id} is assessed from the exact answer phrase "${answer.answer.split(".")[0]}".`,
    created_at: new Date(2026, 6, 14, 12, sequence).toISOString(),
  }));
  const shouldPersist = process.argv.includes("--persist");
  let dossierId: string | undefined;
  let attempts: number;
  let analysis;
  if (shouldPersist) {
    const session = await createVivaSession(graph, undefined, sourceText, fixture.title);
    for (const entry of decision_log) {
      await appendDecisionLog({
        sessionId: session.id,
        sequence: entry.sequence,
        transcriptSegment: entry.transcript_segment,
        answeredAtMs: entry.answered_at_ms,
        decision: { ...entry, quality_gate: { status: "passed", attempts: 1, failures: [] } },
      });
    }
    await persistTranscript(session.id, transcript);
    await completeVivaSession(session.id);
    const saved = await generateAndPersistDossier(session.id);
    const dossier = await loadDossier(saved.id);
    dossierId = dossier.id;
    attempts = 1;
    analysis = dossier.analysis;
  } else {
    const result = await analyzeDivergence({ source_text: sourceText, graph, transcript, decision_log });
    attempts = result.attempts;
    analysis = result.analysis;
  }
  console.log(JSON.stringify({
    attempts,
    dossierId,
    dossierPath: dossierId ? `/dossier/${dossierId}` : undefined,
    claimsDefended: analysis.claims_defended.map((claim) => claim.claim_id),
    findings: analysis.findings.map((finding) => ({ type: finding.type, claimId: finding.claim_id, timestamp: finding.timestamp, docSpan: finding.doc_span })),
  }, null, 2));
  const weakFindings = analysis.findings.filter((finding) => finding.claim_id === fixture.expected_finding.claim_id && finding.type === fixture.expected_finding.type);
  const defendedIds = new Set(decision_log.filter((entry) => entry.assessment === "strong").map((entry) => entry.target_claim_id));
  assert.ok(weakFindings.length >= 1, "The weak paragraph did not produce cannot_reconstruct.");
  assert.ok(analysis.findings.every((finding) => !defendedIds.has(finding.claim_id)), "A well-defended paragraph received a finding.");
  const weakClaim = graph.nodes.find((node) => node.id === fixture.expected_finding.claim_id)!;
  assert.deepEqual(weakFindings[0].doc_span, weakClaim.source_span, "The weak finding did not point to the exact claim span.");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
