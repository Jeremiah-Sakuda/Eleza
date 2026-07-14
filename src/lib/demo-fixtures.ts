import { validateGraphAgainstText, type ClaimGraph } from "@/lib/claim-graph";

type ClaimDefinition = { id: string; prefix: string; label: string };

const judgeClaims: ClaimDefinition[] = [
  { id: "claim_thesis", prefix: "Community gardens should", label: "Community gardens should be a permanent part of city planning for food access, relationships, and resilience." },
  { id: "claim_food_access", prefix: "First, gardens give", label: "Gardens provide a modest local supplement to food access." },
  { id: "claim_relationships", prefix: "Second, gardening creates", label: "Repeated cooperation in a shared garden creates opportunities for neighborhood trust." },
  { id: "claim_resilience", prefix: "Gardens also make", label: "Gardens improve resilience by preserving neighborhood coordination during disruptions." },
  { id: "claim_land_use", prefix: "Opponents argue", label: "Carefully sited gardens need not compete with urgently needed housing." },
  { id: "claim_stewardship", prefix: "Another objection", label: "Renewable leases and public reporting can make volunteer stewardship durable." },
  { id: "claim_education", prefix: "The educational benefit", label: "Gardens make ecological learning local, direct, and visible." },
  { id: "claim_policy", prefix: "For these reasons", label: "Cities should pair long-term leases with maintenance grants and stewardship rules." },
];

const practiceClaims: ClaimDefinition[] = [
  { id: "claim_transit_thesis", prefix: "A city should", label: "A downtown bus-only corridor would use constrained street space more effectively." },
  { id: "claim_predictability", prefix: "The first benefit", label: "A dedicated lane makes bus travel times more predictable and useful." },
  { id: "claim_congestion", prefix: "Critics argue", label: "Traffic displacement is a manageable qualification rather than a decisive objection." },
  { id: "claim_pilot", prefix: "The corridor should", label: "A public one-year pilot can test access and public-space benefits against costs." },
];

function graphFromParagraphs(sourceText: string, definitions: ClaimDefinition[], edges: ClaimGraph["edges"]): ClaimGraph {
  const nodes = definitions.map((definition) => {
    const start = sourceText.indexOf(definition.prefix);
    if (start < 0) throw new Error(`Demo fixture is missing paragraph prefix: ${definition.prefix}`);
    const breakAt = sourceText.indexOf("\n", start);
    return {
      id: definition.id,
      type: "claim" as const,
      label: definition.label,
      source_span: { start, end: breakAt === -1 ? sourceText.length : breakAt },
    };
  });
  return validateGraphAgainstText({ nodes, edges }, sourceText);
}

export function judgeDemoGraph(sourceText: string) {
  return graphFromParagraphs(sourceText, judgeClaims, [
    { source: "claim_food_access", target: "claim_thesis", type: "supports" },
    { source: "claim_relationships", target: "claim_thesis", type: "supports" },
    { source: "claim_resilience", target: "claim_thesis", type: "supports" },
    { source: "claim_land_use", target: "claim_thesis", type: "rebuts" },
    { source: "claim_stewardship", target: "claim_policy", type: "supports" },
    { source: "claim_education", target: "claim_thesis", type: "supports" },
    { source: "claim_policy", target: "claim_thesis", type: "depends_on" },
  ]);
}

export function practiceDemoGraph(sourceText: string) {
  return graphFromParagraphs(sourceText, practiceClaims, [
    { source: "claim_predictability", target: "claim_transit_thesis", type: "supports" },
    { source: "claim_congestion", target: "claim_transit_thesis", type: "rebuts" },
    { source: "claim_pilot", target: "claim_transit_thesis", type: "depends_on" },
  ]);
}
