import assert from "node:assert/strict";
import test from "node:test";
import { hasValidJudgeAccessCode, judgeDailyCap } from "../src/lib/judge-access";

test("judge access uses an exact constant-time code comparison", () => {
  assert.equal(hasValidJudgeAccessCode("judge-demo-2026", "judge-demo-2026"), true);
  assert.equal(hasValidJudgeAccessCode("judge-demo", "judge-demo-2026"), false);
  assert.equal(hasValidJudgeAccessCode(undefined, "judge-demo-2026"), false);
});

test("judge daily cap defaults to 50 and accepts a positive configured integer", () => {
  const previous = process.env.JUDGE_DAILY_CAP;
  delete process.env.JUDGE_DAILY_CAP;
  assert.equal(judgeDailyCap(), 50);
  process.env.JUDGE_DAILY_CAP = "73";
  assert.equal(judgeDailyCap(), 73);
  if (previous === undefined) delete process.env.JUDGE_DAILY_CAP;
  else process.env.JUDGE_DAILY_CAP = previous;
});
