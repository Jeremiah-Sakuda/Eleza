import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { graphNodeSchema } from "@/lib/claim-graph";
import { decisionLogEntrySchema } from "@/lib/decision-log";
import { MODELS } from "@/lib/models";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(800),
});

export const metaVivaInputSchema = z.object({
  decision: decisionLogEntrySchema,
  target_claim: graphNodeSchema.refine((node) => node.type === "claim", "Meta-viva target must be a claim."),
  messages: z.array(messageSchema).min(1).max(6),
}).superRefine((input, context) => {
  if (input.decision.target_claim_id !== input.target_claim.id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target_claim"], message: "Target claim must match the decision log entry." });
  }
  if (input.messages.filter((message) => message.role === "user").length > 3) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["messages"], message: "Meta-viva exchanges allow at most three user turns." });
  }
});

export const metaVivaAnswerSchema = z.object({ answer: z.string().min(20).max(1200) });
export type MetaVivaInput = z.infer<typeof metaVivaInputSchema>;
export type MetaVivaMessage = z.infer<typeof messageSchema>;
export type MetaVivaAnswer = z.infer<typeof metaVivaAnswerSchema>;
export type MetaVivaGenerator = (args: { prompt: string; input: MetaVivaInput }) => Promise<unknown>;

const promptPath = path.join(process.cwd(), "prompts", "meta-viva.md");

export function metaVivaGroundingFailures(answer: string, input: MetaVivaInput) {
  const failures: string[] = [];
  if (!answer.includes(input.target_claim.id)) failures.push(`Answer must cite ${input.target_claim.id}.`);
  const quoted = [...answer.matchAll(/["“]([^"”]+)["”]/g)].map((match) => match[1].trim());
  if (!quoted.some((phrase) => phrase.length >= 12 && input.decision.rationale.includes(phrase))) {
    failures.push("Answer must quote a substantive exact phrase from the decision rationale.");
  }
  return failures;
}

export async function answerMetaViva(rawInput: MetaVivaInput, options: { generate?: MetaVivaGenerator } = {}): Promise<MetaVivaAnswer> {
  const input = metaVivaInputSchema.parse(rawInput);
  const prompt = await readFile(promptPath, "utf8");
  const generate = options.generate ?? generateWithOpenAI;
  const candidate = metaVivaAnswerSchema.safeParse(await generate({ prompt, input }));
  if (candidate.success && metaVivaGroundingFailures(candidate.data.answer, input).length === 0) return candidate.data;
  // DECISION: an invalid meta-viva answer collapses to a grounded limitation statement instead of retrying into confabulation.
  return { answer: groundedLimitation(input) };
}

function groundedLimitation(input: MetaVivaInput) {
  const segments = input.decision.rationale.split(/["“”]/).map((part) => part.trim()).filter((part) => part.length >= 12);
  const excerpt = (segments.sort((a, b) => b.length - a.length)[0] ?? input.decision.rationale).slice(0, 180);
  return `For ${input.target_claim.id}, I can only answer from this routing record. Its rationale says "${excerpt}". The available decision, claim, and transcript segment do not establish anything beyond that record.`;
}

async function generateWithOpenAI({ prompt, input }: { prompt: string; input: MetaVivaInput }) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for the routing meta-viva.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: MODELS.metaViva,
    input: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify({
        decision_log_entry: input.decision,
        target_claim: input.target_claim,
        transcript_segment: input.decision.transcript_segment,
        exchange: input.messages,
      }) },
    ],
    text: { format: { type: "json_schema", name: "meta_viva_answer", strict: true, schema: zodToJsonSchema(metaVivaAnswerSchema, { $refStrategy: "none" }) } },
  });
  if (!response.output_text) throw new Error("The routing meta-viva returned no answer.");
  return JSON.parse(response.output_text);
}
