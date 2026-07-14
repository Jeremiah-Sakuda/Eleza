import { z } from "zod";

export const graphNodeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  type: z.enum(["claim", "evidence", "citation"]),
  label: z.string().min(3).max(160),
  source_span: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }),
});

export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: z.enum(["supports", "rebuts", "depends_on"]),
});

export const claimGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(1),
  edges: z.array(graphEdgeSchema),
});

export type ClaimGraph = z.infer<typeof claimGraphSchema>;
export type ClaimGraphNode = z.infer<typeof graphNodeSchema>;

export function validateGraphAgainstText(graph: ClaimGraph, sourceText: string): ClaimGraph {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate graph node ID: ${node.id}`);
    ids.add(node.id);
    if (node.source_span.end > sourceText.length || node.source_span.start >= node.source_span.end) {
      throw new Error(`Node ${node.id} has an invalid document span.`);
    }
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      throw new Error(`Edge ${edge.source} → ${edge.target} references a missing node.`);
    }
  }
  return graph;
}
