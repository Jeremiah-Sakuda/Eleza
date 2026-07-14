// Centralized routing keeps tier changes explicit and reviewable.
export const MODELS = {
  claimGraph: "gpt-5.6-sol",
  examiner: "gpt-5.6-terra",
  examinerRetry: "gpt-5.6-sol",
  realtime: "gpt-realtime-2.1",
} as const;
