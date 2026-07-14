import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { ClaimGraph } from "../src/lib/claim-graph";
import type { DecisionLogEntry } from "../src/lib/decision-log";
import { analyzeDivergence, validateDivergenceAnalysis, type DivergenceInput } from "../src/lib/divergence";

type WeakFixture = {
  claims: Array<{ id: string; paragraph_prefix: string; label: string }>;
  answers: Array<{
    claim_id: string;
    timestamp: number;
    question: string;
    answer: string;
    assessment: DecisionLogEntry["assessment"];
  }>;
  expected_finding: { claim_id: string; type: "cannot_reconstruct" };
};

async function weakInput() {
  const sourceText = await readFile(path.join(process.cwd(), "fixtures/community-gardens-argument.txt"), "utf8");
  const fixture = JSON.parse(await readFile(path.join(process.cwd(), "fixtures/divergence/weak-viva.json"), "utf8")) as WeakFixture;
  const nodes = fixture.claims.map((claim) => {
    const start = sourceText.indexOf(claim.paragraph_prefix);
    assert.ok(start >= 0);
    const nextBreak = sourceText.indexOf("\n", start);
    return { id: claim.id, type: "claim" as const, label: claim.label, source_span: { start, end: nextBreak === -1 ? sourceText.length : nextBreak } };
  });
  const graph: ClaimGraph = {
    nodes,
    edges: [
      { source: "claim_food_access", target: "claim_relationships", type: "supports" },
      { source: "claim_relationships", target: "claim_resilience", type: "depends_on" },
    ],
  };
  const transcript: DivergenceInput["transcript"] = fixture.answers.flatMap((answer, index) => [
    { id: `q-${index}`, speaker: "examiner" as const, text: answer.question, elapsedMs: answer.timestamp - 12_000, targetClaimId: answer.claim_id, questionKind: index === 0 ? "opening" as const : "adaptive" as const },
    { id: `a-${index}`, speaker: "student" as const, text: answer.answer, elapsedMs: answer.timestamp, targetClaimId: answer.claim_id, questionKind: index === 0 ? "opening" as const : "adaptive" as const },
  ]);
  const decision_log = fixture.answers.map((answer, sequence): DecisionLogEntry => ({
    id: `00000000-0000-4000-8000-${String(sequence + 1).padStart(12, "0")}`,
    viva_session_id: "10000000-0000-4000-8000-000000000000",
    sequence,
    transcript_segment: answer.answer,
    answered_at_ms: answer.timestamp,
    answer_summary: answer.assessment === "strong" ? "The student reconstructs the target claim." : "The student cannot reconstruct the target mechanism.",
    target_claim_id: answer.claim_id,
    assessment: answer.assessment,
    action: answer.assessment === "strong" ? "advance" : "probe",
    next_claim_id: answer.assessment === "strong" ? fixture.answers[Math.min(sequence + 1, fixture.answers.length - 1)].claim_id : answer.claim_id,
    next_question: answer.assessment === "strong" ? "Move to the next claim and explain it." : "What connects the shared tasks to trust?",
    rationale: `${answer.claim_id} is grounded in the answer phrase "${answer.answer.split(".")[0]}" and routes from the content given.`,
    created_at: new Date(2026, 6, 14, 12, sequence).toISOString(),
  }));
  return { fixture, input: { source_text: sourceText, graph, transcript, decision_log } satisfies DivergenceInput };
}

test("weak paragraph-three viva yields one exact cannot_reconstruct receipt and no findings on defended claims", async () => {
  const { fixture, input } = await weakInput();
  const weakDecision = input.decision_log.find((entry) => entry.target_claim_id === fixture.expected_finding.claim_id)!;
  const weakClaim = input.graph.nodes.find((node) => node.id === fixture.expected_finding.claim_id)!;
  const strongDecisions = input.decision_log.filter((entry) => entry.assessment === "strong");
  const result = await analyzeDivergence(input, {
    generate: async () => ({
      claims_defended: strongDecisions.map((entry) => ({
        claim_id: entry.target_claim_id,
        timestamp: entry.answered_at_ms,
        transcript_excerpt: entry.transcript_segment,
        note: "The answer reconstructs the claim's specific content and limitation.",
      })),
      findings: [{
        timestamp: weakDecision.answered_at_ms,
        transcript_excerpt: "I cannot reconstruct paragraph three.",
        claim_id: weakDecision.target_claim_id,
        doc_span: weakClaim.source_span,
        type: "cannot_reconstruct",
        note: "The student explicitly cannot rebuild the essay's causal link from repeated shared tasks to neighborhood trust.",
      }],
    }),
  });

  assert.equal(result.analysis.findings.length, 1);
  assert.equal(result.analysis.findings[0].claim_id, fixture.expected_finding.claim_id);
  assert.equal(result.analysis.findings[0].type, fixture.expected_finding.type);
  assert.deepEqual(result.analysis.findings[0].doc_span, weakClaim.source_span);
  assert.deepEqual(result.analysis.findings.map((finding) => finding.claim_id).filter((id) => strongDecisions.some((entry) => entry.target_claim_id === id)), []);
  assert.equal(result.analysis.claims_defended.length, 2);
});

test("receipt validator rejects invented spans and false findings on strong claims", async () => {
  const { input } = await weakInput();
  const strong = input.decision_log.find((entry) => entry.assessment === "strong")!;
  assert.throws(() => validateDivergenceAnalysis({
    claims_defended: [],
    findings: [{
      timestamp: strong.answered_at_ms,
      transcript_excerpt: strong.transcript_segment,
      claim_id: strong.target_claim_id,
      doc_span: { start: 0, end: 4 },
      type: "cannot_reconstruct",
      note: "This deliberately invalid receipt should never survive validation.",
    }],
  }, input), /span|assessment|strongly defended/i);
});

test("divergence retries once after a semantic receipt failure", async () => {
  const { fixture, input } = await weakInput();
  const weak = input.decision_log.find((entry) => entry.target_claim_id === fixture.expected_finding.claim_id)!;
  const claim = input.graph.nodes.find((node) => node.id === weak.target_claim_id)!;
  let calls = 0;
  const result = await analyzeDivergence(input, { generate: async ({ feedback }) => {
    calls += 1;
    if (calls === 1) return { claims_defended: [], findings: [{ timestamp: 1, transcript_excerpt: "invented", claim_id: weak.target_claim_id, doc_span: claim.source_span, type: "cannot_reconstruct", note: "Invalid first receipt for retry coverage." }] };
    assert.ok(feedback.join(" ").includes("timestamp"));
    return { claims_defended: [], findings: [{ timestamp: weak.answered_at_ms, transcript_excerpt: "I cannot reconstruct paragraph three.", claim_id: weak.target_claim_id, doc_span: claim.source_span, type: "cannot_reconstruct", note: "The answer explicitly cannot reconstruct the repeated-cooperation claim." }] };
  }});
  assert.equal(calls, 2);
  assert.equal(result.attempts, 2);
  assert.equal(result.analysis.findings[0].type, "cannot_reconstruct");
});
