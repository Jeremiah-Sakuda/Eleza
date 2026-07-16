import assert from "node:assert/strict";
import test from "node:test";
import { answerMetaViva, metaVivaGroundingFailures, metaVivaInputSchema } from "../src/lib/meta-viva";

const input = {
  decision: {
    id: "b8b3bf69-dd4d-42d7-9449-29b03b7efa74",
    viva_session_id: "35332c1d-3c9c-4553-a541-d6158cfdc6e9",
    sequence: 0,
    transcript_segment: "The garden helps because neighbors already know who can coordinate tools and check on older residents.",
    answered_at_ms: 12_000,
    answer_summary: "The answer identifies prior coordination as the resilience mechanism.",
    target_claim_id: "claim_resilience",
    assessment: "strong" as const,
    action: "advance" as const,
    next_claim_id: "claim_land_use",
    next_question: "How does site selection answer the housing objection?",
    rationale: "claim_resilience is supported because the answer says \"neighbors already know who can coordinate tools\", which reconstructs the coordination mechanism.",
    created_at: "2026-07-16T12:00:00.000Z",
  },
  target_claim: {
    id: "claim_resilience",
    type: "claim" as const,
    label: "Gardens preserve neighborhood coordination during disruptions.",
    source_span: { start: 1273, end: 1754 },
  },
  messages: [{ role: "user" as const, content: "Why did the examiner advance?" }],
};

test("meta-viva accepts an answer grounded in the claim and decision rationale", async () => {
  const result = await answerMetaViva(input, {
    generate: async () => ({ answer: "For claim_resilience, the rationale says \"which reconstructs the coordination mechanism\"; that record supports advancing because the mechanism was supplied." }),
  });
  assert.deepEqual(metaVivaGroundingFailures(result.answer, metaVivaInputSchema.parse(input)), []);
});

test("meta-viva replaces ungrounded outside-record claims with an honest limitation", async () => {
  const result = await answerMetaViva(input, {
    generate: async () => ({ answer: "The student probably used outside help and should be investigated." }),
  });
  assert.match(result.answer, /claim_resilience/);
  assert.match(result.answer, /do not establish anything beyond that record/);
  assert.deepEqual(metaVivaGroundingFailures(result.answer, metaVivaInputSchema.parse(input)), []);
});

test("meta-viva rejects a fourth user turn", () => {
  const messages = [1, 2, 3, 4].map((number) => ({ role: "user" as const, content: `Question ${number}` }));
  assert.equal(metaVivaInputSchema.safeParse({ ...input, messages }).success, false);
});
