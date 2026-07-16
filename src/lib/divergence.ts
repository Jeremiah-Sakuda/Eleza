import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { claimGraphSchema } from "@/lib/claim-graph";
import { decisionLogEntrySchema } from "@/lib/decision-log";
import { divergenceAnalysisSchema, divergenceModelAnalysisSchema, type DivergenceAnalysis } from "@/lib/divergence-schema";
import { MODELS } from "@/lib/models";

export const transcriptTurnSchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["examiner", "student"]),
  text: z.string().min(1),
  elapsedMs: z.number().int().nonnegative(),
  targetClaimId: z.string().optional(),
  questionKind: z.enum(["opening", "bridge", "adaptive"]).optional(),
});

export const divergenceInputSchema = z.object({
  source_text: z.string().min(1),
  graph: claimGraphSchema,
  transcript: z.array(transcriptTurnSchema),
  decision_log: z.array(decisionLogEntrySchema),
});

export type DivergenceInput = z.infer<typeof divergenceInputSchema>;
export type TranscriptTurnInput = z.infer<typeof transcriptTurnSchema>;
export type DivergenceGenerator = (args: { model: string; prompt: string; input: DivergenceInput; feedback: string[] }) => Promise<unknown>;

const promptPath = path.join(process.cwd(), "prompts", "divergence.md");

function containsExact(haystack: string, needle: string) {
  return haystack.toLocaleLowerCase().includes(needle.trim().toLocaleLowerCase());
}

export function validateDivergenceAnalysis(raw: unknown, rawInput: DivergenceInput): DivergenceAnalysis {
  const input = divergenceInputSchema.parse(rawInput);
  const claims = new Map(input.graph.nodes.filter((node) => node.type === "claim").map((node) => [node.id, node]));
  const decisionsByReceipt = new Map(input.decision_log.map((entry) => [`${entry.target_claim_id}:${entry.answered_at_ms}`, entry]));

  const validated = divergenceModelAnalysisSchema.superRefine((analysis, context) => {
    const seenFindings = new Set<string>();
    for (const [index, finding] of analysis.findings.entries()) {
      const claim = claims.get(finding.claim_id);
      const receipt = decisionsByReceipt.get(`${finding.claim_id}:${finding.timestamp}`);
      if (!claim) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "claim_id"], message: "Finding must reference a claim node." });
        continue;
      }
      if (finding.doc_span.start !== claim.source_span.start || finding.doc_span.end !== claim.source_span.end) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "doc_span"], message: "Finding span must exactly match the claim source span." });
      }
      if (!receipt) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "timestamp"], message: "Finding timestamp must identify a decision for the same claim." });
      } else if (!containsExact(receipt.transcript_segment, finding.transcript_excerpt)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "transcript_excerpt"], message: "Finding excerpt must be an exact phrase from the cited answer." });
      }

      const claimDecisions = input.decision_log.filter((entry) => entry.target_claim_id === finding.claim_id);
      const allowedAssessments = finding.type === "inconsistency"
        ? ["contradictory"]
        : finding.type === "cannot_reconstruct"
          ? ["unsupported", "off_topic"]
          : ["partial", "unsupported"];
      if (!receipt || !allowedAssessments.includes(receipt.assessment)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "type"], message: `${finding.type} is not supported by the cited examiner assessment.` });
      }
      if (finding.type !== "inconsistency" && claimDecisions.some((entry) => entry.assessment === "strong")) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index, "type"], message: "A strongly defended claim cannot receive this finding type." });
      }
      const fingerprint = `${finding.claim_id}:${finding.type}:${finding.timestamp}`;
      if (seenFindings.has(fingerprint)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["findings", index], message: "Duplicate finding receipt." });
      }
      seenFindings.add(fingerprint);
    }

    const seenDefended = new Set<string>();
    for (const [index, defended] of analysis.claims_defended.entries()) {
      const claim = claims.get(defended.claim_id);
      const receipt = decisionsByReceipt.get(`${defended.claim_id}:${defended.timestamp}`);
      if (!claim) context.addIssue({ code: z.ZodIssueCode.custom, path: ["claims_defended", index, "claim_id"], message: "Defended item must reference a claim node." });
      if (!receipt || receipt.assessment !== "strong") {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["claims_defended", index, "timestamp"], message: "Defended item must cite a strong decision for the same claim." });
      } else if (!containsExact(receipt.transcript_segment, defended.transcript_excerpt)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ["claims_defended", index, "transcript_excerpt"], message: "Defended excerpt must be an exact phrase from the cited answer." });
      }
      if (seenDefended.has(defended.claim_id)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["claims_defended", index], message: "List each defended claim once." });
      seenDefended.add(defended.claim_id);
    }
  }).parse(raw);
  return divergenceAnalysisSchema.parse(validated);
}

export async function analyzeDivergence(
  rawInput: DivergenceInput,
  options: { generate?: DivergenceGenerator; maxRetries?: number } = {},
) {
  const input = divergenceInputSchema.parse(rawInput);
  const prompt = await readFile(promptPath, "utf8");
  const generate = options.generate ?? generateWithOpenAI;
  const failures: string[] = [];
  const maxRetries = options.maxRetries ?? 1;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const raw = await generate({ model: MODELS.divergence, prompt, input, feedback: failures });
    try {
      return { analysis: validateDivergenceAnalysis(raw, input), attempts: attempt + 1, failures };
    } catch (error) {
      const message = error instanceof z.ZodError
        ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
        : error instanceof Error ? error.message : "Unknown divergence validation failure.";
      failures.push(`Attempt ${attempt + 1}: ${message}`);
    }
  }
  throw new Error(`Divergence analysis failed receipt validation: ${failures.join(" | ")}`);
}

async function generateWithOpenAI({ model, prompt, input, feedback }: Parameters<DivergenceGenerator>[0]) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to generate a dossier.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // DECISION: source evidence is sent once and the model returns only compact classifications; transcript and logs remain canonical database records.
  const response = await openai.responses.create({
    model,
    input: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify({ ...input, validation_feedback: feedback }) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "divergence_analysis",
        strict: true,
        schema: zodToJsonSchema(divergenceModelAnalysisSchema, { $refStrategy: "none" }),
      },
    },
  });
  if (!response.output_text) throw new Error("Divergence analysis returned no structured output.");
  return JSON.parse(response.output_text);
}
