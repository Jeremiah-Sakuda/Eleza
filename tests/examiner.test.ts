import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { examineAnswer, evaluateRationale, evaluateRouting, type ExaminerDecision, type ExaminerInput } from "../src/lib/examiner";

type Fixture = {
  name: string;
  expected_assessment: ExaminerDecision["assessment"];
  expected_action: ExaminerDecision["action"];
  input: ExaminerInput;
};

const fixtureNames = ["strong", "restated-conclusion", "contradictory", "evasive", "off-topic"];

async function loadFixture(name: string): Promise<Fixture> {
  const contents = await readFile(path.join(process.cwd(), "fixtures", "examiner", `${name}.json`), "utf8");
  return JSON.parse(contents) as Fixture;
}

function exactQuoteFor(transcript: string) {
  return transcript.split(/(?<=[.!?])\s+/)[0];
}

for (const fixtureName of fixtureNames) {
  test(`examiner accepts a specific rationale for ${fixtureName}`, async () => {
    const fixture = await loadFixture(fixtureName);
    let calls = 0;
    const result = await examineAnswer(fixture.input, {
      generate: async ({ model, stablePrefix }) => {
        calls += 1;
        assert.ok(stablePrefix.includes("## Claim graph JSON"));
        if (calls === 1 && fixtureName !== "strong") {
          assert.equal(model, "gpt-5.6-terra");
          return {
            answer_summary: "The response did not fully answer the question.",
            target_claim_id: fixture.input.target_claim.id,
            assessment: fixture.expected_assessment,
            action: fixture.expected_action,
            next_claim_id: fixture.expected_action === "advance" ? "claim_thesis" : fixture.input.target_claim.id,
            next_question: "Can you explain the mechanism more directly?",
            rationale: `${fixture.input.target_claim.id}: the answer was vague.`,
          };
        }
        if (calls > 1) assert.equal(model, "gpt-5.6-sol");
        const quote = exactQuoteFor(fixture.input.transcript_segment);
        return {
          answer_summary: `The student response is ${fixture.expected_assessment.replace("_", " ")}.`,
          target_claim_id: fixture.input.target_claim.id,
          assessment: fixture.expected_assessment,
          action: fixture.expected_action,
          next_claim_id: fixture.expected_action === "advance" ? "claim_thesis" : fixture.input.target_claim.id,
          next_question: fixture.expected_action === "advance" ? "How does the next claim support the thesis?" : "What mechanism connects the garden to resilience?",
          rationale: `${fixture.input.target_claim.id} is assessed as ${fixture.expected_assessment} because the answer says "${quote}", which directly shows the content available for this claim.`,
        };
      },
    });

    assert.equal(result.assessment, fixture.expected_assessment);
    assert.equal(result.action, fixture.expected_action);
    assert.equal(result.quality_gate.status, "passed");
    assert.deepEqual(evaluateRationale(result, fixture.input), []);
    assert.deepEqual(evaluateRouting(result, fixture.input), []);
    assert.equal(result.quality_gate.attempts, fixtureName === "strong" ? 1 : 2);
  });
}

test("examiner flags output after two rationale-gate retries", async () => {
  const fixture = await loadFixture("evasive");
  const result = await examineAnswer(fixture.input, {
    generate: async () => ({
      answer_summary: "The student avoids the requested explanation.",
      target_claim_id: fixture.input.target_claim.id,
      assessment: "unsupported",
      action: "probe",
      next_claim_id: fixture.input.target_claim.id,
      next_question: "Please explain the mechanism.",
      rationale: "The answer was vague.",
    }),
  });
  assert.equal(result.quality_gate.status, "flagged");
  assert.equal(result.quality_gate.attempts, 3);
  assert.ok(result.quality_gate.failures.length >= 6);
});

test("rationale gate rejects a two-character transcript quote", async () => {
  const fixture = await loadFixture("strong");
  const decision = {
    answer_summary: "The response explains the claim.",
    target_claim_id: fixture.input.target_claim.id,
    assessment: "strong" as const,
    action: "advance" as const,
    next_claim_id: "claim_thesis",
    next_question: "How does the next claim support the thesis?",
    rationale: `${fixture.input.target_claim.id} relies on "it" from the answer.`,
  };
  assert.ok(evaluateRationale(decision, fixture.input).some((failure) => failure.includes("five words or 25 contiguous characters")));
});

test("rationale gate accepts an exact 25-character contiguous quote", async () => {
  const fixture = await loadFixture("strong");
  const quote = fixture.input.transcript_segment.slice(0, 25);
  assert.equal(quote.length, 25);
  const decision = {
    answer_summary: "The response explains the claim.",
    target_claim_id: fixture.input.target_claim.id,
    assessment: "strong" as const,
    action: "advance" as const,
    next_claim_id: "claim_thesis",
    next_question: "How does the next claim support the thesis?",
    rationale: `${fixture.input.target_claim.id} is grounded in "${quote}" from the answer.`,
  };
  assert.deepEqual(evaluateRationale(decision, fixture.input), []);
});

test("rationale gate rejects a paraphrase with transcript words in the wrong order", async () => {
  const fixture = await loadFixture("strong");
  const words = fixture.input.transcript_segment.split(/\s+/).slice(0, 6).reverse().join(" ");
  const decision = {
    answer_summary: "The response explains the claim.",
    target_claim_id: fixture.input.target_claim.id,
    assessment: "strong" as const,
    action: "advance" as const,
    next_claim_id: "claim_thesis",
    next_question: "How does the next claim support the thesis?",
    rationale: `${fixture.input.target_claim.id} is grounded in "${words}" from the answer.`,
  };
  assert.ok(evaluateRationale(decision, fixture.input).length > 0);
});
