import { z } from "zod";

export const assessmentSchema = z.enum(["strong", "partial", "unsupported", "contradictory", "off_topic"]);

export const examinerDecisionSchema = z.object({
  answer_summary: z.string().min(5).max(300),
  target_claim_id: z.string(),
  assessment: assessmentSchema,
  action: z.enum(["probe", "branch", "advance"]),
  next_claim_id: z.string(),
  next_question: z.string().min(5).max(400),
  rationale: z.string().min(20).max(800),
});

export type ExaminerDecision = z.infer<typeof examinerDecisionSchema>;
