import { z } from "zod";

export const divergenceTypeSchema = z.enum([
  "cannot_reconstruct",
  "mechanism_gap",
  "inconsistency",
]);

export const documentSpanSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
});

export const divergenceFindingSchema = z.object({
  timestamp: z.number().int().nonnegative(),
  transcript_excerpt: z.string().min(1).max(600),
  claim_id: z.string().min(1),
  doc_span: documentSpanSchema,
  type: divergenceTypeSchema,
  note: z.string().min(12).max(800),
});

export const defendedClaimSchema = z.object({
  claim_id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  transcript_excerpt: z.string().min(1).max(600),
  note: z.string().min(12).max(800),
});

export const divergenceAnalysisSchema = z.object({
  claims_defended: z.array(defendedClaimSchema),
  findings: z.array(divergenceFindingSchema),
});

export type DivergenceFinding = z.infer<typeof divergenceFindingSchema>;
export type DefendedClaim = z.infer<typeof defendedClaimSchema>;
export type DivergenceAnalysis = z.infer<typeof divergenceAnalysisSchema>;
