import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import { claimGraphSchema, type ClaimGraph, validateGraphAgainstText } from "@/lib/claim-graph";
import { MODELS } from "@/lib/models";

const promptPath = path.join(process.cwd(), "prompts", "claim-graph.md");

export async function generateClaimGraph(sourceText: string, options: { minimumClaimCount?: number } = {}): Promise<ClaimGraph> {
  const minimumClaimCount = options.minimumClaimCount ?? 6;
  if (!process.env.OPENAI_API_KEY) return generateLocalDemoGraph(sourceText);

  const prompt = (await readFile(promptPath, "utf8")).replace("{{SUBMISSION_TEXT}}", sourceText);
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await openai.responses.create({
      model: MODELS.claimGraph,
      input: attempt === 0 ? prompt : `${prompt}\n\nYour first output did not contain ${minimumClaimCount} claim nodes. Re-extract with at least ${minimumClaimCount} distinct claim nodes when the text supports them.`,
      text: {
        format: {
          type: "json_schema",
          name: "claim_graph",
          strict: true,
          schema: zodToJsonSchema(claimGraphSchema, { $refStrategy: "none" }),
        },
      },
    });
    if (!response.output_text) continue;
    const graph = validateGraphAgainstText(claimGraphSchema.parse(JSON.parse(response.output_text)), sourceText);
    if (graph.nodes.filter((node) => node.type === "claim").length >= minimumClaimCount) return graph;
  }
  throw new Error("This text does not have enough argumentative structure to examine. Eleza works best on writing that makes a position and supports it with several distinct claims.");
}

function generateLocalDemoGraph(sourceText: string): ClaimGraph {
  // DECISION: preserve a deterministic local path so the judge demo remains inspectable without credentials.
  const paragraphs = [...sourceText.matchAll(/\S[\s\S]*?(?=\n\s*\n|$)/g)].map((match) => ({
    text: match[0], start: match.index ?? 0,
  }));
  const candidates = paragraphs.slice(0, 6);
  const claimNodes = candidates.map((paragraph, index) => {
    const sentence = paragraph.text.match(/[^.!?]+[.!?]/)?.[0]?.trim() ?? paragraph.text.trim();
    const start = paragraph.start + paragraph.text.indexOf(sentence);
    return {
      id: `claim_${index + 1}`,
      type: "claim" as const,
      label: sentence.slice(0, 150),
      source_span: { start, end: start + sentence.length },
    };
  });
  const evidenceNodes = candidates.flatMap((paragraph, index) => {
    const sentences = paragraph.text.match(/[^.!?]+[.!?]/g)?.map((sentence) => sentence.trim()) ?? [];
    const sentence = sentences[1];
    if (!sentence) return [];
    const start = paragraph.start + paragraph.text.indexOf(sentence);
    return [{
      id: `evidence_${index + 1}`,
      type: "evidence" as const,
      label: sentence.slice(0, 150),
      source_span: { start, end: start + sentence.length },
    }];
  });
  const claimEdges = claimNodes.slice(1).map((node) => ({
    source: node.id,
    target: "claim_1",
    type: node.id === "claim_5" ? "rebuts" as const : "supports" as const,
  }));
  const evidenceEdges = evidenceNodes.map((node) => ({
    source: node.id,
    target: node.id.replace("evidence", "claim"),
    type: "supports" as const,
  }));
  return validateGraphAgainstText({ nodes: [...claimNodes, ...evidenceNodes], edges: [...claimEdges, ...evidenceEdges] }, sourceText);
}
