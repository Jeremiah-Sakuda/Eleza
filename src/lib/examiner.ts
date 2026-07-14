import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { claimGraphSchema, graphNodeSchema } from "@/lib/claim-graph";
import { examinerDecisionSchema, type ExaminerDecision } from "@/lib/examiner-schema";
import { MODELS } from "@/lib/models";

export { assessmentSchema, examinerDecisionSchema } from "@/lib/examiner-schema";
export type { ExaminerDecision } from "@/lib/examiner-schema";

export const examinerInputSchema = z.object({
  transcript_segment: z.string().min(1),
  target_claim: graphNodeSchema.refine((node) => node.type === "claim", "Target node must be a claim."),
  graph: claimGraphSchema,
});

export type ExaminerInput = z.infer<typeof examinerInputSchema>;
export type RationaleGate = {
  status: "passed" | "flagged";
  attempts: number;
  failures: string[];
};
export type ExaminerResult = ExaminerDecision & { quality_gate: RationaleGate };

type GenerateArgs = {
  model: string;
  stablePrefix: string;
  freshSuffix: string;
};
export type ExaminerGenerator = (args: GenerateArgs) => Promise<unknown>;

const examinerPromptPath = path.join(process.cwd(), "prompts", "examiner.md");

export function evaluateRationale(decision: ExaminerDecision, input: ExaminerInput): string[] {
  const failures: string[] = [];
  if (decision.target_claim_id !== input.target_claim.id || !decision.rationale.includes(input.target_claim.id)) {
    failures.push(`Rationale must cite target claim ${input.target_claim.id}.`);
  }
  const quotedPhrases = [...decision.rationale.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1].trim());
  const transcript = input.transcript_segment.toLocaleLowerCase();
  const hasExactAnswerQuote = quotedPhrases.some((phrase) => phrase.length >= 2 && transcript.includes(phrase.toLocaleLowerCase()));
  if (!hasExactAnswerQuote) failures.push("Rationale must quote an exact phrase from the transcript segment.");
  return failures;
}

export function evaluateRouting(decision: ExaminerDecision, input: ExaminerInput): string[] {
  const failures: string[] = [];
  const claimIds = new Set(input.graph.nodes.filter((node) => node.type === "claim").map((node) => node.id));
  if (!claimIds.has(decision.next_claim_id)) failures.push(`Next question must target a claim node; ${decision.next_claim_id} is not one.`);
  if (decision.action === "probe" && decision.next_claim_id !== input.target_claim.id) {
    failures.push("A probe must remain on the current target claim.");
  }
  if (decision.action === "advance" && claimIds.size > 1 && decision.next_claim_id === input.target_claim.id) {
    failures.push("An advance must move to another claim node.");
  }
  if (decision.action === "branch") {
    const connected = input.graph.edges.some((edge) =>
      (edge.source === input.target_claim.id && edge.target === decision.next_claim_id)
      || (edge.target === input.target_claim.id && edge.source === decision.next_claim_id));
    if (!connected) failures.push("A branch must target a graph node directly connected to the current claim.");
  }
  return failures;
}

function gatedDecisionSchema(input: ExaminerInput) {
  return examinerDecisionSchema.superRefine((decision, context) => {
    for (const failure of [...evaluateRationale(decision, input), ...evaluateRouting(decision, input)]) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["rationale"], message: failure });
    }
  });
}

export async function examineAnswer(
  rawInput: ExaminerInput,
  options: { generate?: ExaminerGenerator; maxRetries?: number } = {},
): Promise<ExaminerResult> {
  const input = examinerInputSchema.parse(rawInput);
  const prompt = await readFile(examinerPromptPath, "utf8");
  // DECISION: graph plus system prompt is a byte-identical prefix so live-turn cache reads stay reusable.
  const stablePrefix = `${prompt}\n\n## Claim graph JSON\n${JSON.stringify(input.graph)}`;
  const generate = options.generate ?? generateWithOpenAI;
  const maxRetries = options.maxRetries ?? 2;
  const failures: string[] = [];
  let lastDecision: ExaminerDecision | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const model = attempt === 0 ? MODELS.examiner : MODELS.examinerRetry;
    const freshSuffix = JSON.stringify({
      target_claim_id: input.target_claim.id,
      target_claim: input.target_claim,
      transcript_segment: input.transcript_segment,
      retry_feedback: attempt === 0 ? [] : failures,
    });
    const candidate = examinerDecisionSchema.safeParse(await generate({ model, stablePrefix, freshSuffix }));
    if (!candidate.success) {
      failures.push(`Attempt ${attempt + 1}: structured output failed base schema validation.`);
      continue;
    }
    lastDecision = candidate.data;
    const gated = gatedDecisionSchema(input).safeParse(candidate.data);
    if (gated.success) {
      return { ...gated.data, quality_gate: { status: "passed", attempts: attempt + 1, failures } };
    }
    failures.push(...[...evaluateRationale(candidate.data, input), ...evaluateRouting(candidate.data, input)]
      .map((failure) => `Attempt ${attempt + 1}: ${failure}`));
  }

  if (!lastDecision) throw new Error("Examiner failed to return structured output after all attempts.");
  return { ...lastDecision, quality_gate: { status: "flagged", attempts: maxRetries + 1, failures } };
}

async function generateWithOpenAI({ model, stablePrefix, freshSuffix }: GenerateArgs): Promise<unknown> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required to call the examiner.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model,
    input: [
      { role: "system", content: stablePrefix },
      { role: "user", content: freshSuffix },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "examiner_decision",
        strict: true,
        schema: zodToJsonSchema(examinerDecisionSchema, { $refStrategy: "none" }),
      },
    },
  });
  if (!response.output_text) throw new Error("Examiner returned no structured output.");
  return JSON.parse(response.output_text);
}
