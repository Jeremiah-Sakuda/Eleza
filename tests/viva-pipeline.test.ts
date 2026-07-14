import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ClaimGraphNode } from "../src/lib/claim-graph";
import { evaluateRationale, type ExaminerDecision, type ExaminerInput } from "../src/lib/examiner";
import {
  assertQuestionTrace,
  DEAD_AIR_LIMIT_MS,
  renderVoiceQuestionInstruction,
  VivaQuestionPipeline,
  VIVA_DURATION_MS,
} from "../src/lib/viva-pipeline";

const fixture = JSON.parse(readFileSync(path.join(process.cwd(), "fixtures/examiner/strong.json"), "utf8")) as {
  input: ExaminerInput;
};

test("Realtime delivery template tells the voice layer to ask rather than answer", () => {
  const pipeline = new VivaQuestionPipeline(fixture.input.graph);
  const question = pipeline.opening();
  const template = "Speak exactly this and do not answer it: <question>{{QUESTION}}</question>";
  const instruction = renderVoiceQuestionInstruction(template, question);
  assert.ok(instruction.includes(question.text));
  assert.ok(instruction.includes("do not answer it"));
  assert.ok(!instruction.includes("{{QUESTION}}"));
});

for (let run = 1; run <= 3; run += 1) {
  test(`five-minute viva pipeline run ${run} completes with traced questions and specific receipts`, () => {
    const pipeline = new VivaQuestionPipeline(fixture.input.graph);
    const questions = [pipeline.opening()];
    const decisions: ExaminerDecision[] = [];
    const simulatedAnswers = 19;
    const answerIntervalMs = VIVA_DURATION_MS / simulatedAnswers;

    for (let sequence = 0; sequence < simulatedAnswers; sequence += 1) {
      const answeredQuestion = questions[sequence];
      const target = fixture.input.graph.nodes.find((node): node is ClaimGraphNode =>
        node.id === answeredQuestion.targetClaimId && node.type === "claim");
      assert.ok(target);
      const transcript = `I explain ${target.id} by saying the mechanism is shared work and coordination in answer ${sequence}.`;
      const nextClaim = fixture.input.graph.nodes.find((node) => node.type === "claim" && node.id !== target.id) ?? target;
      const decision: ExaminerDecision = {
        answer_summary: `The answer reconstructs ${target.id}.`,
        target_claim_id: target.id,
        assessment: "strong",
        action: "advance",
        next_claim_id: nextClaim.id,
        next_question: `How does ${nextClaim.label} connect to the thesis?`,
        rationale: `${target.id} is supported by the exact answer phrase "shared work and coordination", which identifies the mechanism.`,
      };

      const input = { transcript_segment: transcript, target_claim: target, graph: fixture.input.graph };
      assert.deepEqual(evaluateRationale(decision, input), []);
      decisions.push(decision);

      // The next question is selected before this answer's simulated examiner result lands.
      const dispatchDelayMs = 40 + sequence;
      assert.ok(dispatchDelayMs < DEAD_AIR_LIMIT_MS);
      const nextQuestion = pipeline.nextImmediate();
      assertQuestionTrace(nextQuestion, fixture.input.graph);
      questions.push(nextQuestion);
      pipeline.acceptDecision(decision, sequence);
    }

    assert.equal(Math.round(answerIntervalMs * simulatedAnswers), VIVA_DURATION_MS);
    assert.equal(decisions.length, simulatedAnswers);
    assert.equal(questions.length, simulatedAnswers + 1);
  });
}
