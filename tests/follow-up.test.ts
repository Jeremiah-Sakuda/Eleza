import assert from "node:assert/strict";
import test from "node:test";
import type { ClaimGraph } from "../src/lib/claim-graph";
import { divergenceFindingSchema } from "../src/lib/divergence-schema";
import { attachFindingFollowUps, generateFindingFollowUps } from "../src/lib/follow-up";

const graph: ClaimGraph = {
  nodes: [{ id: "claim_resilience", type: "claim", label: "Coordination supports resilience.", source_span: { start: 0, end: 40 } }],
  edges: [],
};
const finding = divergenceFindingSchema.parse({
  timestamp: 20_000,
  transcript_excerpt: "I do not know how coordination helps.",
  claim_id: "claim_resilience",
  doc_span: { start: 0, end: 40 },
  type: "mechanism_gap",
  note: "The answer does not reconstruct how prior coordination supports resilience.",
});

test("follow-up generation requires two or three questions tied to the finding claim", async () => {
  const groups = await generateFindingFollowUps([finding], graph, { generate: async () => ({
    findings: [{
      claim_id: "claim_resilience",
      timestamp: 20_000,
      questions: [
        "For claim_resilience, how does prior coordination change what neighbors can do during a disruption?",
        "Which step in claim_resilience connects knowing local coordinators to neighborhood resilience?",
      ],
    }],
  }) });
  const enriched = attachFindingFollowUps([finding], groups);
  assert.equal(enriched[0].follow_up_questions.length, 2);
  assert.ok(enriched[0].follow_up_questions.every((question) => question.includes("claim_resilience")));
});

test("follow-up generation retries when questions lose their claim receipt", async () => {
  let calls = 0;
  const groups = await generateFindingFollowUps([finding], graph, { generate: async ({ feedback }) => {
    calls += 1;
    if (calls === 1) return { findings: [{ claim_id: "claim_resilience", timestamp: 20_000, questions: ["How does coordination help here?", "What mechanism is missing here?"] }] };
    assert.match(feedback.join(" "), /reference claim_resilience/);
    return { findings: [{ claim_id: "claim_resilience", timestamp: 20_000, questions: [
      "For claim_resilience, what role does the existing coordination network play?",
      "How would you reconstruct the causal steps in claim_resilience during a disruption?",
    ] }] };
  } });
  assert.equal(calls, 2);
  assert.equal(groups.length, 1);
});
