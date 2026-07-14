import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { claimGraphSchema, type ClaimGraph, validateGraphAgainstText } from "@/lib/claim-graph";

const promptPath = path.join(process.cwd(), "prompts", "claim-graph.md");

export async function generateClaimGraph(sourceText: string): Promise<ClaimGraph> {
  if (!process.env.OPENAI_API_KEY) return generateLocalDemoGraph(sourceText);

  const prompt = (await readFile(promptPath, "utf8")).replace("{{SUBMISSION_TEXT}}", sourceText);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: "gpt-5.6",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "claim_graph",
        strict: true,
        schema: zodToJsonSchema(claimGraphSchema, { $refStrategy: "none" }),
      },
    },
  });
  if (!response.output_text) throw new Error("The graph extractor returned no structured output.");
  const graph = claimGraphSchema.parse(JSON.parse(response.output_text));
  return validateGraphAgainstText(graph, sourceText);
}

function generateLocalDemoGraph(sourceText: string): ClaimGraph {
  // DECISION: preserve a deterministic local path so the judge demo remains inspectable without credentials.
  const paragraphs = [...sourceText.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g)].map((match) => ({
    text: match[0], start: match.index ?? 0,
  }));
  const candidates = paragraphs.slice(0, 6);
  const nodes = candidates.map((paragraph, index) => {
    const sentence = paragraph.text.match(/[^.!?]+[.!?]/)?.[0]?.trim() ?? paragraph.text.trim();
    const start = paragraph.start + paragraph.text.indexOf(sentence);
    return {
      id: `claim_${index + 1}`,
      type: "claim" as const,
      label: sentence.slice(0, 150),
      source_span: { start, end: start + sentence.length },
    };
  });
  const edges = nodes.slice(1).map((node, index) => ({ source: node.id, target: "claim_1", type: "supports" as const }));
  return validateGraphAgainstText({ nodes, edges }, sourceText);
}
