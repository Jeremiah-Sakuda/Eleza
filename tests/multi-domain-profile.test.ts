import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { claimGraphSchemaForProfile, isPrimaryNode, validateGraphAgainstText } from "../src/lib/claim-graph";
import { caseAnalysisDemoGraph, labReportDemoGraph } from "../src/lib/demo-fixtures";
import { getDomainProfile, type ProfileId } from "../src/lib/domain-profile";
import { analyzeDivergence, type DivergenceInput } from "../src/lib/divergence";
import { buildExaminerStablePrefix } from "../src/lib/examiner";
import { renderClaimGraphPrompt } from "../src/lib/generate-claim-graph";
import { answerMetaViva, metaVivaGroundingFailures, metaVivaInputSchema } from "../src/lib/meta-viva";
import { understandingMapState } from "../src/lib/understanding-map";
import { VivaQuestionPipeline } from "../src/lib/viva-pipeline";
import type { DecisionLogEntry } from "../src/lib/decision-log";

type NewProfileId = "lab_report" | "case_analysis";
type WeakFixture = {
  answers: Array<{ claim_id: string; timestamp: number; answer: string; assessment: DecisionLogEntry["assessment"] }>;
  expected_finding: { claim_id: string; type: "cannot_reconstruct" | "mechanism_gap" };
};

const fixtures = {
  lab_report: {
    source: "fixtures/lab-photosynthesis-report.txt",
    weak: "fixtures/divergence/lab-weak-viva.json",
    graph: labReportDemoGraph,
    graphTerms: ["hypothesis", "method_choice", "tests"],
    promptPhrase: "what outcome would have falsified the hypothesis",
  },
  case_analysis: {
    source: "fixtures/case-expansion-memo.txt",
    weak: "fixtures/divergence/case-weak-viva.json",
    graph: caseAnalysisDemoGraph,
    graphTerms: ["recommendation", "rejected_alternative", "undermines"],
    promptPhrase: "which assumption, if wrong, breaks the recommendation",
  },
} as const;

async function loadFixture(profileId: NewProfileId) {
  const definition = fixtures[profileId];
  const sourceText = await readFile(path.join(process.cwd(), definition.source), "utf8");
  const graph = definition.graph(sourceText);
  const weak = JSON.parse(await readFile(path.join(process.cwd(), definition.weak), "utf8")) as WeakFixture;
  return { definition, sourceText, graph, weak };
}

function decisionLogFromWeakFixture(fixture: WeakFixture): DecisionLogEntry[] {
  return fixture.answers.map((answer, sequence) => ({
    id: `40000000-0000-4000-8000-${String(sequence + 1).padStart(12, "0")}`,
    viva_session_id: "50000000-0000-4000-8000-000000000000",
    sequence,
    transcript_segment: answer.answer,
    answered_at_ms: answer.timestamp,
    answer_summary: answer.assessment === "strong" ? "The target was reconstructed with its dependency." : "The target dependency was not reconstructed.",
    target_claim_id: answer.claim_id,
    assessment: answer.assessment,
    action: answer.assessment === "strong" ? "advance" : "probe",
    next_claim_id: answer.assessment === "strong" ? fixture.answers[Math.min(sequence + 1, fixture.answers.length - 1)].claim_id : answer.claim_id,
    next_question: answer.assessment === "strong" ? "Explain the next graph node." : "Which missing dependency carries this node?",
    rationale: `${answer.claim_id} routes from the exact answer phrase "${answer.answer}" and stays grounded in that receipt.`,
    created_at: new Date(Date.UTC(2026, 6, 18, 14, sequence)).toISOString(),
  }));
}

for (const profileId of ["lab_report", "case_analysis"] as const) {
  test(`${profileId} graph has real spans, strict vocabulary, and a deterministic routed viva`, async () => {
    const { sourceText, graph } = await loadFixture(profileId);
    assert.deepEqual(validateGraphAgainstText(claimGraphSchemaForProfile(profileId).parse(graph), sourceText, profileId), graph);
    assert.ok(graph.nodes.length >= 6);
    for (const node of graph.nodes) {
      assert.ok(sourceText.slice(node.source_span.start, node.source_span.end).trim().length > 0, `${node.id} must map to source text`);
      assert.ok(isPrimaryNode(node, profileId));
    }
    const runs = Array.from({ length: 2 }, () => {
      const pipeline = new VivaQuestionPipeline(graph, profileId);
      return [pipeline.opening(), ...Array.from({ length: 12 }, () => pipeline.nextImmediate())].map((question) => {
        assert.ok(graph.nodes.some((node) => node.id === question.targetClaimId && isPrimaryNode(node, profileId)));
        return question.targetClaimId;
      });
    });
    assert.deepEqual(runs[0], runs[1]);
  });

  test(`${profileId} prompt carries its vocabulary and cached prefix remains byte-identical`, async () => {
    const { definition, sourceText, graph } = await loadFixture(profileId);
    const graphPrompt = await renderClaimGraphPrompt(sourceText, profileId);
    for (const term of definition.graphTerms) assert.match(graphPrompt, new RegExp(term));
    const first = await buildExaminerStablePrefix(graph, profileId);
    const second = await buildExaminerStablePrefix(graph, profileId);
    assert.equal(first, second);
    assert.ok(first.includes(definition.promptPhrase));
  });

  test(`${profileId} weak defense yields only its documented span finding`, async () => {
    const { sourceText, graph, weak } = await loadFixture(profileId);
    const decision_log = decisionLogFromWeakFixture(weak);
    const transcript: DivergenceInput["transcript"] = weak.answers.map((answer, index) => ({
      id: `${profileId}-answer-${index}`,
      speaker: "student",
      text: answer.answer,
      elapsedMs: answer.timestamp,
      targetClaimId: answer.claim_id,
      questionKind: index === 0 ? "opening" : "adaptive",
    }));
    const weakDecision = decision_log.find((entry) => entry.target_claim_id === weak.expected_finding.claim_id)!;
    const weakNode = graph.nodes.find((node) => node.id === weak.expected_finding.claim_id)!;
    const strong = decision_log.filter((entry) => entry.assessment === "strong");
    const analysis = await analyzeDivergence({ source_text: sourceText, graph, transcript, decision_log, profile_id: profileId }, {
      generate: async () => ({
        claims_defended: strong.map((entry) => ({
          claim_id: entry.target_claim_id,
          timestamp: entry.answered_at_ms,
          transcript_excerpt: entry.transcript_segment,
          note: "The answer reconstructs the node and its concrete evidentiary or decision dependency.",
        })),
        findings: [{
          timestamp: weakDecision.answered_at_ms,
          transcript_excerpt: weakDecision.transcript_segment,
          claim_id: weakDecision.target_claim_id,
          doc_span: weakNode.source_span,
          type: weak.expected_finding.type,
          note: "The answer cannot reconstruct the specific dependency represented by this source span.",
        }],
      }),
    });
    assert.equal(analysis.analysis.findings.length, 1);
    assert.equal(analysis.analysis.findings[0].claim_id, weak.expected_finding.claim_id);
    assert.deepEqual(analysis.analysis.findings[0].doc_span, weakNode.source_span);
    assert.ok(analysis.analysis.findings.every((finding) => !strong.some((entry) => entry.target_claim_id === finding.claim_id)));
  });

  test(`${profileId} understanding map and routing meta-viva use the universal records`, async () => {
    const { graph, weak } = await loadFixture(profileId);
    const decisionLog = decisionLogFromWeakFixture(weak);
    const state = understandingMapState(graph, decisionLog, profileId);
    assert.equal(state.length, graph.nodes.length);
    assert.ok(state.some((node) => node.status === "examined"));
    const decision = decisionLog[0];
    const target = graph.nodes.find((node) => node.id === decision.target_claim_id)!;
    const rationaleExcerpt = decision.transcript_segment.slice(0, 80);
    const input = metaVivaInputSchema.parse({
      decision,
      target_claim: target,
      profile_id: profileId,
      messages: [{ role: "user", content: "Why did the examiner route this way?" }],
    });
    const result = await answerMetaViva(input, {
      generate: async () => ({ answer: `For ${target.id}, the routing record quotes "${rationaleExcerpt}" and uses only that answer receipt and graph node.` }),
    });
    assert.deepEqual(metaVivaGroundingFailures(result.answer, input), []);
  });
}

test("all four profiles keep universal gates while exposing their own dossier vocabulary", () => {
  const expected = new Map<ProfileId, string>([
    ["essay", "CLAIMS DEFENDED"],
    ["code", "DECISIONS DEFENDED"],
    ["lab_report", "INTERPRETATIONS DEFENDED"],
    ["case_analysis", "ASSUMPTIONS DEFENDED"],
  ]);
  for (const [profileId, heading] of expected) {
    assert.equal(getDomainProfile(profileId).dossier_vocab.claims_defended, heading);
    assert.equal(getDomainProfile(profileId).dossier_vocab.understanding_map, "UNDERSTANDING MAP");
  }
});
