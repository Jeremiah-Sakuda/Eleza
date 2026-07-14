export const SCRIPTED_QUESTIONS = [
  "State the central claim of the essay in your own words.",
  "What mechanism connects a community garden to improved food access?",
  "Your essay says repeated cooperation builds trust. Walk me through that causal link.",
  "Why is resilience more than the number of vegetables harvested?",
  "What did the storm example demonstrate about neighborhood organization?",
  "How does your land-use qualification answer the housing objection?",
  "Why would a three-year lease make volunteer stewardship more durable?",
  "Which limitation of your argument matters most, and why?",
] as const;

export const TRANSPORT_PROOF_DURATION_MS = 180_000;

export type TranscriptTurn = {
  id: string;
  speaker: "examiner" | "student";
  text: string;
  elapsedMs: number;
};

export class ScriptedQuestionDriver {
  private index = 0;

  constructor(private readonly questions: readonly string[] = SCRIPTED_QUESTIONS) {}

  next(): { index: number; question: string } | null {
    const question = this.questions[this.index];
    if (!question) return null;
    const current = { index: this.index, question };
    this.index += 1;
    return current;
  }

  get asked() { return this.index; }
  get remaining() { return Math.max(0, this.questions.length - this.index); }
}

export function transportProofTimestamp(questionIndex: number, questionCount = SCRIPTED_QUESTIONS.length) {
  if (questionCount < 2 || questionIndex < 0 || questionIndex >= questionCount) {
    throw new RangeError("Transport proof question index is out of range.");
  }
  const examinerAt = Math.round((questionIndex / (questionCount - 1)) * (TRANSPORT_PROOF_DURATION_MS - 12_000));
  return { examinerAt, studentAt: examinerAt + 12_000 };
}

export function formatElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
