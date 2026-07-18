import { z } from "zod";
import { getDomainProfile, type ProfileId } from "@/lib/domain-profile";

export const graphNodeTypeSchema = z.enum([
  "claim", "evidence", "citation",
  "design_decision", "implementation", "assumption",
]);
export const graphEdgeTypeSchema = z.enum([
  "supports", "rebuts", "depends_on",
  "constrains", "alternative_to",
]);

export const graphNodeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  type: graphNodeTypeSchema,
  label: z.string().min(3).max(160),
  source_span: z.object({ start: z.number().int().nonnegative(), end: z.number().int().positive() }),
});

export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  type: graphEdgeTypeSchema,
});

export const claimGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(1),
  edges: z.array(graphEdgeSchema),
});

// DECISION: persistence accepts the shared vocabulary union, while every model and session boundary locks graphs to one profile-specific schema.
const essayClaimGraphSchema = z.object({
  nodes: z.array(graphNodeSchema.extend({ type: z.enum(["claim", "evidence", "citation"]) })).min(1),
  edges: z.array(graphEdgeSchema.extend({ type: z.enum(["supports", "rebuts", "depends_on"]) })),
});
const codeClaimGraphSchema = z.object({
  nodes: z.array(graphNodeSchema.extend({ type: z.enum(["design_decision", "implementation", "assumption"]) })).min(1),
  edges: z.array(graphEdgeSchema.extend({ type: z.enum(["depends_on", "constrains", "alternative_to"]) })),
});

export type ClaimGraph = z.infer<typeof claimGraphSchema>;
export type ClaimGraphNode = z.infer<typeof graphNodeSchema>;

export function primaryNodeType(profileId: ProfileId = "essay") {
  return getDomainProfile(profileId).node_types[0];
}

export function isPrimaryNode(node: ClaimGraphNode, profileId: ProfileId = "essay") {
  return node.type === primaryNodeType(profileId);
}

export function claimGraphSchemaForProfile(profileId: ProfileId = "essay") {
  return profileId === "code" ? codeClaimGraphSchema : essayClaimGraphSchema;
}

export function validateGraphAgainstText(graph: ClaimGraph, sourceText: string, profileId?: ProfileId): ClaimGraph {
  const parsed = profileId ? claimGraphSchemaForProfile(profileId).parse(graph) : claimGraphSchema.parse(graph);
  const ids = new Set<string>();
  for (const node of parsed.nodes) {
    if (ids.has(node.id)) throw new Error(`Duplicate graph node ID: ${node.id}`);
    ids.add(node.id);
    if (node.source_span.end > sourceText.length || node.source_span.start >= node.source_span.end) {
      throw new Error(`Node ${node.id} has an invalid document span.`);
    }
  }
  for (const edge of parsed.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      throw new Error(`Edge ${edge.source} → ${edge.target} references a missing node.`);
    }
  }
  return parsed;
}
