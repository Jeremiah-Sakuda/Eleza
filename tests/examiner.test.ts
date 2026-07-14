import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { examineAnswer, evaluateRationale, type ExaminerDecision, type ExaminerInput } from "../src/lib/examiner";

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
          next_question: fixture.expected_action === "advance" ? "How does the next claim support the thesis?" : "What mechanism connects the garden to resilience?",
          rationale: `${fixture.input.target_claim.id} is assessed as ${fixture.expected_assessment} because the answer says "${quote}", which directly shows the content available for this claim.`,
        };
      },
    });

    assert.equal(result.assessment, fixture.expected_assessment);
    assert.equal(result.action, fixture.expected_action);
    assert.equal(result.quality_gate.status, "passed");
    assert.deepEqual(evaluateRationale(result, fixture.input), []);
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
      next_question: "Please explain the mechanism.",
      rationale: "The answer was vague.",
    }),
  });
  assert.equal(result.quality_gate.status, "flagged");
  assert.equal(result.quality_gate.attempts, 3);
  assert.ok(result.quality_gate.failures.length >= 6);
});
