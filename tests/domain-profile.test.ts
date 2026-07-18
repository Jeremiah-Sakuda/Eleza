import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { essayProfile } from "../profiles/essay";
import { judgeDemoGraph } from "../src/lib/demo-fixtures";
import { examineAnswer, renderExaminerPrompt } from "../src/lib/examiner";
import { renderClaimGraphPrompt } from "../src/lib/generate-claim-graph";
import { VivaQuestionPipeline } from "../src/lib/viva-pipeline";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

test("essay profile preserves the pre-refactor rendered prompts byte for byte", async () => {
  const sourceText = await readFile(path.join(process.cwd(), essayProfile.fixture), "utf8");
  assert.equal(sha256(await renderClaimGraphPrompt(sourceText, "essay")), "00774d729d9d5ef78d4ed9d048de7319865665665b2de72de9859bfd67131be3");
  assert.equal(sha256(await renderExaminerPrompt("essay")), "9f90491c663e289d48be9d217e60168ae64d56ddb8bf41d91615b14eed28ced6");
  assert.deepEqual(essayProfile.node_types, ["claim", "evidence", "citation"]);
  assert.deepEqual(essayProfile.edge_types, ["supports", "rebuts", "depends_on"]);
});

test("examiner cached prefix stays byte-identical across turns in one essay viva", async () => {
  const sourceText = await readFile(path.join(process.cwd(), essayProfile.fixture), "utf8");
  const graph = judgeDemoGraph(sourceText);
  const target = graph.nodes.find((node) => node.id === "claim_thesis")!;
  const next = graph.nodes.find((node) => node.id === "claim_food_access")!;
  const stablePrefixes: string[] = [];
  const freshSuffixes: string[] = [];

  for (const transcript of [
    "Permanent gardens connect food access with neighborhood relationships and resilience.",
    "City planning makes those benefits durable instead of leaving each garden temporary.",
  ]) {
    const result = await examineAnswer({ transcript_segment: transcript, target_claim: target, graph, profile_id: "essay" }, {
      generate: async ({ stablePrefix, freshSuffix }) => {
        stablePrefixes.push(stablePrefix);
        freshSuffixes.push(freshSuffix);
        return {
          answer_summary: "The answer reconstructs the thesis.",
          target_claim_id: target.id,
          assessment: "strong",
          action: "advance",
          next_claim_id: next.id,
          next_question: "How does food access support the thesis?",
          rationale: `${target.id} is grounded in the exact answer phrase "${transcript}", which supplies the stated connection.`,
        };
      },
    });
    assert.equal(result.quality_gate.status, "passed");
  }

  assert.equal(stablePrefixes.length, 2);
  assert.equal(stablePrefixes[0], stablePrefixes[1]);
  assert.equal(sha256(stablePrefixes[0]), "0bf3deebc7fc8b8dc6064316a5ff24eb8d40150f3847722597b6436f800a4e5e");
  assert.notEqual(freshSuffixes[0], freshSuffixes[1]);
});

test("essay dossier vocabulary preserves existing section headings", () => {
  assert.deepEqual(essayProfile.dossier_vocab, {
    claims_defended: "CLAIMS DEFENDED",
    understanding_map: "UNDERSTANDING MAP",
  });
});

test("deterministic fixture dossier bytes change only by profile metadata", async () => {
  const sourceText = await readFile(path.join(process.cwd(), essayProfile.fixture), "utf8");
  const graph = judgeDemoGraph(sourceText);
  const pipeline = new VivaQuestionPipeline(graph);
  const transcript: Array<{ speaker: "examiner" | "student"; text: string; target_claim_id: string }> = [];
  const decision_log = [];
  let question = pipeline.opening();

  for (let sequence = 0; sequence < graph.nodes.length; sequence += 1) {
    const target = graph.nodes.find((node) => node.id === question.targetClaimId)!;
    const next = graph.nodes[(sequence + 1) % graph.nodes.length];
    const answer = `The mechanism for ${target.id} connects the stated benefit to permanent planning.`;
    transcript.push(
      { speaker: "examiner", text: question.text, target_claim_id: target.id },
      { speaker: "student", text: answer, target_claim_id: target.id },
    );
    const decision = {
      answer_summary: `The answer reconstructs ${target.id}.`,
      target_claim_id: target.id,
      assessment: "strong" as const,
      action: "advance" as const,
      next_claim_id: next.id,
      next_question: `How does ${next.label} connect to the thesis?`,
      rationale: `${target.id} uses the exact answer phrase "connects the stated benefit to permanent planning" as its mechanism receipt.`,
    };
    decision_log.push(decision);
    pipeline.acceptDecision(decision, sequence);
    question = pipeline.nextImmediate();
  }

  const preRefactorDossier = {
    title: "Community gardens and resilient neighborhoods",
    source_text: sourceText,
    graph,
    transcript,
    decision_log,
    claims_defended_heading: "CLAIMS DEFENDED",
    understanding_map_heading: "UNDERSTANDING MAP",
  };
  const profiledDossier = {
    ...preRefactorDossier,
    profile_id: essayProfile.id,
    claims_defended_heading: essayProfile.dossier_vocab.claims_defended,
    understanding_map_heading: essayProfile.dossier_vocab.understanding_map,
  };
  const { profile_id: _profileMetadata, ...withoutProfileMetadata } = profiledDossier;
  assert.equal(JSON.stringify(withoutProfileMetadata), JSON.stringify(preRefactorDossier));
});
