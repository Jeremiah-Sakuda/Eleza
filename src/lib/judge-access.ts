import { timingSafeEqual } from "node:crypto";

export function judgeDailyCap() {
  const parsed = Number(process.env.JUDGE_DAILY_CAP);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 50;
}

export function hasValidJudgeAccessCode(candidate: string | undefined, configured = process.env.JUDGE_ACCESS_CODE) {
  if (!candidate) return false;
  if (!configured) throw new Error("Judge access is not configured.");
  const received = Buffer.from(candidate, "utf8");
  const expected = Buffer.from(configured, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
