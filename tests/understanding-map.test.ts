import assert from "node:assert/strict";
import test from "node:test";
import type { ClaimGraph } from "../src/lib/claim-graph";
import type { DecisionLogEntry } from "../src/lib/decision-log";
import { understandingMapState } from "../src/lib/understanding-map";

const graph: ClaimGraph = {
  nodes: [
    { id: "claim_one", type: "claim", label: "First claim", source_span: { start: 0, end: 20 } },
    { id: "claim_two", type: "claim", label: "Second claim", source_span: { start: 21, end: 42 } },
    { id: "claim_three", type: "claim", label: "Third claim", source_span: { start: 43, end: 64 } },
  ],
  edges: [{ source: "claim_two", target: "claim_one", type: "supports" }],
};

function entry(overrides: Partial<DecisionLogEntry>): DecisionLogEntry {
  return {
    id: crypto.randomUUID(),
    viva_session_id: crypto.randomUUID(),
    sequence: 0,
    transcript_segment: "The answer reconstructs this claim with a specific mechanism.",
    answered_at_ms: 1000,
    answer_summary: "The answer reconstructs the claim.",
    target_claim_id: "claim_one",
    assessment: "strong",
    action: "advance",
    next_claim_id: "claim_two",
    next_question: "How does the second claim support the first?",
    rationale: "claim_one uses the exact answer phrase \"reconstructs this claim with a specific mechanism\" to support advancing.",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

test("understanding map derives all coverage only from the decision log", () => {
  const state = understandingMapState(graph, [entry({})]);
  assert.deepEqual(state.map(({ claim, status }) => [claim.id, status]), [
    ["claim_one", "examined"],
    ["claim_two", "being_examined"],
    ["claim_three", "not_yet_examined"],
  ]);
});

test("latest routing decision owns the being-examined state", () => {
  const state = understandingMapState(graph, [
    entry({}),
    entry({ sequence: 1, target_claim_id: "claim_two", assessment: "partial", action: "probe", next_claim_id: "claim_two" }),
  ]);
  assert.equal(state.find(({ claim }) => claim.id === "claim_two")?.status, "being_examined");
  assert.equal(state.find(({ claim }) => claim.id === "claim_one")?.status, "examined");
});
