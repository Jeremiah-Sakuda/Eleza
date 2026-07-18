import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { claimGraphSchemaForProfile, isPrimaryNode, validateGraphAgainstText } from "../src/lib/claim-graph";
import { codeDemoGraph } from "../src/lib/demo-fixtures";
import { getDomainProfile } from "../src/lib/domain-profile";
import { analyzeDivergence, type DivergenceInput } from "../src/lib/divergence";
import { buildExaminerStablePrefix, examineAnswer } from "../src/lib/examiner";
import { renderClaimGraphPrompt } from "../src/lib/generate-claim-graph";
import type { DecisionLogEntry } from "../src/lib/decision-log";
import { VivaQuestionPipeline } from "../src/lib/viva-pipeline";

type CodeWeakFixture = {
  answers: Array<{ claim_id: string; timestamp: number; answer: string; assessment: DecisionLogEntry["assessment"] }>;
  expected_finding: { claim_id: string; type: "mechanism_gap" };
};

async function codeFixture() {
  const sourceText = await readFile(path.join(process.cwd(), "fixtures/code-inventory-tracker.py"), "utf8");
  return { sourceText, graph: codeDemoGraph(sourceText) };
}

test("code graph uses only profile vocabulary and every function or branch span resolves to source", async () => {
  const { sourceText, graph } = await codeFixture();
  const parsed = claimGraphSchemaForProfile("code").parse(graph);
  assert.deepEqual(validateGraphAgainstText(parsed, sourceText, "code"), graph);
  assert.ok(graph.nodes.filter((node) => isPrimaryNode(node, "code")).length >= 4);
  for (const node of graph.nodes) {
    const receipt = sourceText.slice(node.source_span.start, node.source_span.end);
    assert.ok(receipt.trim().length > 0, `${node.id} must resolve to real code`);
  }
});

test("deterministic code viva routes every question only to design-decision nodes", async () => {
  const { graph } = await codeFixture();
  const runs = Array.from({ length: 2 }, () => {
    const pipeline = new VivaQuestionPipeline(graph, "code");
    const ids = [pipeline.opening(), ...Array.from({ length: 12 }, () => pipeline.nextImmediate())].map((question) => question.targetClaimId);
    assert.ok(ids.every((id) => graph.nodes.some((node) => node.id === id && node.type === "design_decision")));
    return ids;
  });
  assert.deepEqual(runs[0], runs[1]);
});

test("code prompts carry profile vocabulary and retain a byte-identical cached prefix across turns", async () => {
  const { sourceText, graph } = await codeFixture();
  const graphPrompt = await renderClaimGraphPrompt(sourceText, "code");
  assert.match(graphPrompt, /design_decision/);
  assert.match(graphPrompt, /alternative_to/);
  assert.match(graphPrompt, /Prefer complete function or branch spans/);
  const first = await buildExaminerStablePrefix(graph, "code");
  const second = await buildExaminerStablePrefix(graph, "code");
  assert.equal(first, second);
  assert.match(first, /what breaks if a constraint changes/);
});

test("unchanged rationale gate accepts a substantial exact quote about code", async () => {
  const { graph } = await codeFixture();
  const target = graph.nodes.find((node) => node.id === "design_decision_decimal_money")!;
  const transcript = "Decimal avoids binary floating point rounding in prices, while keeping totals exact for saved inventory values.";
  const result = await examineAnswer({ transcript_segment: transcript, target_claim: target, graph, profile_id: "code" }, {
    generate: async () => ({
      answer_summary: "The answer justifies Decimal using its concrete rounding behavior.",
      target_claim_id: target.id,
      assessment: "strong",
      action: "advance",
      next_claim_id: "design_decision_skip_bad_rows",
      next_question: "Why skip malformed rows instead of stopping the import?",
      rationale: `${target.id} is specifically supported by "Decimal avoids binary floating point rounding in prices", which identifies the failure avoided by this choice.`,
    }),
  });
  assert.equal(result.quality_gate.status, "passed");
  assert.equal(result.quality_gate.attempts, 1);
});

test("scripted weak code defense yields one weak-spot finding and none on defended decisions", async () => {
  const { sourceText, graph } = await codeFixture();
  const fixture = JSON.parse(await readFile(path.join(process.cwd(), "fixtures/divergence/code-weak-viva.json"), "utf8")) as CodeWeakFixture;
  const decision_log = fixture.answers.map((answer, sequence): DecisionLogEntry => ({
    id: `20000000-0000-4000-8000-${String(sequence + 1).padStart(12, "0")}`,
    viva_session_id: "30000000-0000-4000-8000-000000000000",
    sequence,
    transcript_segment: answer.answer,
    answered_at_ms: answer.timestamp,
    answer_summary: answer.assessment === "strong" ? "The decision and failure mode were reconstructed." : "The choice was named without its failure mode.",
    target_claim_id: answer.claim_id,
    assessment: answer.assessment,
    action: answer.assessment === "strong" ? "advance" : "probe",
    next_claim_id: answer.assessment === "strong" ? fixture.answers[Math.min(sequence + 1, fixture.answers.length - 1)].claim_id : answer.claim_id,
    next_question: answer.assessment === "strong" ? "Explain the next design decision." : "What duplicate-name input breaks this structure?",
    rationale: `${answer.claim_id} is grounded in "${answer.answer}" and routes from that exact code explanation.`,
    created_at: new Date(Date.UTC(2026, 6, 18, 12, sequence)).toISOString(),
  }));
  const transcript: DivergenceInput["transcript"] = fixture.answers.map((answer, index) => ({
    id: `code-answer-${index}`,
    speaker: "student",
    text: answer.answer,
    elapsedMs: answer.timestamp,
    targetClaimId: answer.claim_id,
    questionKind: index === 0 ? "opening" : "adaptive",
  }));
  const input = { source_text: sourceText, graph, transcript, decision_log, profile_id: "code" } satisfies DivergenceInput;
  const weak = decision_log[0];
  const weakNode = graph.nodes.find((node) => node.id === fixture.expected_finding.claim_id)!;
  const strong = decision_log.filter((entry) => entry.assessment === "strong");
  const result = await analyzeDivergence(input, { generate: async () => ({
    claims_defended: strong.map((entry) => ({ claim_id: entry.target_claim_id, timestamp: entry.answered_at_ms, transcript_excerpt: entry.transcript_segment, note: "The answer reconstructs the implementation choice and its concrete consequence." })),
    findings: [{
      timestamp: weak.answered_at_ms,
      transcript_excerpt: "I cannot explain what input makes the name key unsafe",
      claim_id: weak.target_claim_id,
      doc_span: weakNode.source_span,
      type: fixture.expected_finding.type,
      note: "The answer names the dictionary choice but cannot identify that duplicate display names with different SKUs overwrite a record.",
    }],
  }) });
  assert.equal(result.analysis.findings.length, 1);
  assert.equal(result.analysis.findings[0].claim_id, "design_decision_name_key");
  assert.deepEqual(result.analysis.findings[0].doc_span, weakNode.source_span);
  assert.equal(result.analysis.claims_defended.length, 3);
  assert.ok(result.analysis.findings.every((finding) => !strong.some((entry) => entry.target_claim_id === finding.claim_id)));
});

test("code dossier vocabulary reads decisions defended", () => {
  assert.equal(getDomainProfile("code").dossier_vocab.claims_defended, "DECISIONS DEFENDED");
});
