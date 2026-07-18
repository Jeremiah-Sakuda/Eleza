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

type CodeNodeDefinition = {
  id: string;
  type: "design_decision" | "implementation" | "assumption";
  start: string;
  end?: string;
  label: string;
};

const codeNodes: CodeNodeDefinition[] = [
  { id: "design_decision_name_key", type: "design_decision", start: "class Inventory:", end: "    def adjust", label: "Inventory uses a case-normalized item name as its dictionary key." },
  { id: "implementation_adjust_guard", type: "implementation", start: "    def adjust", end: "    def remove", label: "Quantity adjustments reject missing items and negative resulting quantities." },
  { id: "design_decision_sorted_low_stock", type: "design_decision", start: "    def low_stock", end: "    def total_value", label: "Low-stock results are ordered by quantity and then normalized name." },
  { id: "design_decision_decimal_money", type: "design_decision", start: "    def total_value", end: "\n\n\ndef load_inventory", label: "Inventory value uses Decimal arithmetic rather than binary floating point." },
  { id: "design_decision_skip_bad_rows", type: "design_decision", start: "def load_inventory", end: "\n\n\ndef save_inventory", label: "CSV rows with missing or malformed values are skipped while valid rows continue loading." },
  { id: "implementation_stable_save", type: "implementation", start: "def save_inventory", end: "\n\n\ndef print_summary", label: "Saved inventory rows are sorted by SKU for stable output." },
  { id: "assumption_unique_names", type: "assumption", start: "        self.items[item.name.lower()] = item", label: "Product display names are assumed to be unique across SKUs." },
];

export function codeDemoGraph(sourceText: string): ClaimGraph {
  const nodes = codeNodes.map((definition) => {
    const start = sourceText.indexOf(definition.start);
    if (start < 0) throw new Error(`Code fixture is missing span start: ${definition.start}`);
    const end = definition.end
      ? sourceText.indexOf(definition.end, start)
      : start + definition.start.length;
    if (end <= start) throw new Error(`Code fixture is missing span end for ${definition.id}.`);
    return { id: definition.id, type: definition.type, label: definition.label, source_span: { start, end } };
  });
  return validateGraphAgainstText({
    nodes,
    edges: [
      { source: "assumption_unique_names", target: "design_decision_name_key", type: "constrains" },
      { source: "implementation_adjust_guard", target: "design_decision_name_key", type: "depends_on" },
      { source: "design_decision_sorted_low_stock", target: "design_decision_name_key", type: "depends_on" },
      { source: "design_decision_decimal_money", target: "design_decision_name_key", type: "alternative_to" },
      { source: "design_decision_skip_bad_rows", target: "design_decision_name_key", type: "constrains" },
      { source: "implementation_stable_save", target: "design_decision_name_key", type: "depends_on" },
    ],
  }, sourceText, "code");
}
