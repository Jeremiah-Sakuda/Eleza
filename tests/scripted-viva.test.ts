import assert from "node:assert/strict";
import test from "node:test";
import {
  formatElapsed,
  ScriptedQuestionDriver,
  SCRIPTED_QUESTIONS,
  TRANSPORT_PROOF_DURATION_MS,
  transportProofTimestamp,
} from "../src/lib/scripted-viva";

test("hardcoded driver sustains the deterministic three-minute transport proof", () => {
  const driver = new ScriptedQuestionDriver();
  const delivered = SCRIPTED_QUESTIONS.map((question, index) => {
    const next = driver.next();
    assert.deepEqual(next, { index, question });
    return { ...next, ...transportProofTimestamp(index) };
  });

  assert.equal(driver.next(), null);
  assert.equal(driver.asked, SCRIPTED_QUESTIONS.length);
  assert.equal(driver.remaining, 0);
  assert.equal(delivered.at(-1)?.studentAt, TRANSPORT_PROOF_DURATION_MS);
  assert.equal(formatElapsed(TRANSPORT_PROOF_DURATION_MS), "03:00");
});
