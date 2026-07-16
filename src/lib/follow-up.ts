import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { claimGraphSchema, type ClaimGraph } from "@/lib/claim-graph";
import { divergenceFindingBaseSchema, type DivergenceFinding } from "@/lib/divergence-schema";
import { MODELS } from "@/lib/models";

const groupSchema = z.object({
  claim_id: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
  questions: z.array(z.string().min(10).max(400)).min(2).max(3),
});

const outputSchema = z.object({ findings: z.array(groupSchema) });
const inputSchema = z.object({ findings: z.array(divergenceFindingBaseSchema), graph: claimGraphSchema });
type Input = z.infer<typeof inputSchema>;
export type FollowUpGenerator = (args: { prompt: string; input: Input; feedback: string[] }) => Promise<unknown>;

const promptPath = path.join(process.cwd(), "prompts", "follow-up.md");

export async function generateFindingFollowUps(findings: DivergenceFinding[], graph: ClaimGraph, options: { generate?: FollowUpGenerator } = {}) {
  if (findings.length === 0) return [];
  const input = inputSchema.parse({ findings, graph });
  const prompt = await readFile(promptPath, "utf8");
  const generate = options.generate ?? generateWithOpenAI;
  const feedback: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const output = outputSchema.parse(await generate({ prompt, input, feedback }));
      validateGroups(output.findings, input.findings);
      return output.findings;
    } catch (error) {
      feedback.push(`Attempt ${attempt + 1}: ${error instanceof Error ? error.message : "Invalid follow-up output."}`);
    }
  }
  throw new Error(`Teacher follow-up generation failed validation: ${feedback.join(" | ")}`);
}

export function attachFindingFollowUps(findings: DivergenceFinding[], groups: z.infer<typeof groupSchema>[]) {
  const byReceipt = new Map(groups.map((group) => [`${group.claim_id}:${group.timestamp}`, group.questions]));
  return findings.map((finding) => ({ ...finding, follow_up_questions: byReceipt.get(`${finding.claim_id}:${finding.timestamp}`) ?? [] }));
}

function validateGroups(groups: z.infer<typeof groupSchema>[], findings: Array<{ claim_id: string; timestamp: number }>) {
  const expected = new Set(findings.map((finding) => `${finding.claim_id}:${finding.timestamp}`));
  if (groups.length !== expected.size) throw new Error("Every finding must receive exactly one follow-up group.");
  const seen = new Set<string>();
  for (const group of groups) {
    const key = `${group.claim_id}:${group.timestamp}`;
    if (!expected.has(key) || seen.has(key)) throw new Error(`Follow-up group ${key} does not identify one supplied finding.`);
    if (group.questions.some((question) => !question.includes(group.claim_id))) {
      throw new Error(`Every follow-up question must reference ${group.claim_id}.`);
    }
    seen.add(key);
  }
}

async function generateWithOpenAI({ prompt, input, feedback }: Parameters<FollowUpGenerator>[0]) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for teacher follow-up generation.");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: MODELS.followUp,
    input: [
      { role: "system", content: prompt },
      { role: "user", content: JSON.stringify({
        findings: input.findings,
        claim_nodes: input.graph.nodes.filter((node) => node.type === "claim" && input.findings.some((finding) => finding.claim_id === node.id)),
        validation_feedback: feedback,
      }) },
    ],
    text: { format: { type: "json_schema", name: "teacher_follow_up_questions", strict: true, schema: zodToJsonSchema(outputSchema, { $refStrategy: "none" }) } },
  });
  if (!response.output_text) throw new Error("Teacher follow-up generation returned no output.");
  return JSON.parse(response.output_text);
}
