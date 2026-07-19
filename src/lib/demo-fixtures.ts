import { validateGraphAgainstText, type ClaimGraph } from "@/lib/claim-graph";
import type { ProfileId } from "@/lib/domain-profile";

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

type FixtureNodeDefinition = {
  id: string;
  type: ClaimGraph["nodes"][number]["type"];
  text: string;
  label: string;
};

function graphFromExactSpans(
  sourceText: string,
  definitions: FixtureNodeDefinition[],
  edges: ClaimGraph["edges"],
  profileId: ProfileId,
) {
  const nodes = definitions.map((definition) => {
    const start = sourceText.indexOf(definition.text);
    if (start < 0) throw new Error(`${profileId} fixture is missing span: ${definition.text}`);
    return {
      id: definition.id,
      type: definition.type,
      label: definition.label,
      source_span: { start, end: start + definition.text.length },
    };
  });
  return validateGraphAgainstText({ nodes, edges }, sourceText, profileId);
}

const labReportNodes: FixtureNodeDefinition[] = [
  {
    id: "hypothesis_light_rate",
    type: "hypothesis",
    text: "I predicted that a cutting placed closer to the lamp would release more oxygen bubbles per minute because greater light intensity supplies more energy for the light-dependent reactions.",
    label: "A cutting closer to the lamp should release more oxygen bubbles per minute.",
  },
  {
    id: "method_choice_falsification",
    type: "method_choice",
    text: "A result in which the farthest cutting produced as many or more bubbles than the nearest cutting would have counted against this prediction.",
    label: "The report identifies a result that would count against the hypothesis.",
  },
  {
    id: "method_choice_equal_bicarbonate",
    type: "method_choice",
    text: "Sodium bicarbonate was kept equal across cups so dissolved carbon availability would not be the intended difference between conditions.",
    label: "Equal bicarbonate amounts control one source of carbon variation.",
  },
  {
    id: "method_choice_temperature_control",
    type: "method_choice",
    text: "A water-filled beaker stood between the lamp and each cup to reduce heating, and temperature was checked before every count.",
    label: "A water barrier and repeated temperature checks reduce heating as an alternative explanation.",
  },
  {
    id: "interpretation_distance_gradient",
    type: "interpretation",
    text: "These results support the hypothesis within the tested setup because the closest cutting had the highest mean bubble count and the farthest cutting had the lowest.",
    label: "The ordered bubble counts support the prediction within the tested setup.",
  },
  {
    id: "interpretation_temperature_stability",
    type: "interpretation",
    text: "The stable temperature readings make heating a less likely explanation for the pattern, while the equal bicarbonate amounts reduce one source of carbon variation.",
    label: "Stable temperatures and equal bicarbonate make two alternative explanations less likely.",
  },
  {
    id: "conclusion_sole_factor",
    type: "conclusion",
    text: "The trial shows that light intensity is the sole factor controlling photosynthesis rate in aquatic plants under all environmental conditions.",
    label: "The conclusion claims light intensity alone controls photosynthesis in all conditions.",
  },
  {
    id: "conclusion_tested_scope",
    type: "conclusion",
    text: "The measured pattern more narrowly establishes that, for these three cuttings and this lamp arrangement, shorter lamp distance was associated with a higher bubble count.",
    label: "The measured result is limited to the tested cuttings and lamp arrangement.",
  },
];

export function labReportDemoGraph(sourceText: string): ClaimGraph {
  return graphFromExactSpans(sourceText, labReportNodes, [
    { source: "method_choice_falsification", target: "hypothesis_light_rate", type: "tests" },
    { source: "method_choice_equal_bicarbonate", target: "interpretation_temperature_stability", type: "supports" },
    { source: "method_choice_temperature_control", target: "interpretation_temperature_stability", type: "supports" },
    { source: "interpretation_distance_gradient", target: "hypothesis_light_rate", type: "supports" },
    { source: "interpretation_temperature_stability", target: "interpretation_distance_gradient", type: "supports" },
    { source: "conclusion_sole_factor", target: "interpretation_distance_gradient", type: "depends_on" },
    { source: "conclusion_tested_scope", target: "interpretation_distance_gradient", type: "depends_on" },
  ], "lab_report");
}

const caseAnalysisNodes: FixtureNodeDefinition[] = [
  {
    id: "recommendation_pop_up_pilot",
    type: "recommendation",
    text: "The cooperative should run a twelve-week pop-up pickup site in the unused meeting room of the eastern community center.",
    label: "The cooperative should test a twelve-week eastern pop-up pickup site.",
  },
  {
    id: "recommendation_exit_metrics",
    type: "recommendation",
    text: "Continuation should depend on at least forty completed pickups, fewer than five inventory-transfer errors, and survey evidence that the location reduced travel barriers.",
    label: "Continuation depends on explicit demand, reliability, and access measures.",
  },
  {
    id: "assumption_staff_capacity",
    type: "assumption",
    text: "The site would open Tuesday, Thursday, and Saturday afternoons and would hold only items reserved online by noon the previous day.",
    label: "The schedule assumes the existing volunteers can cover three new afternoons without weakening the storefront.",
  },
  {
    id: "tradeoff_reservations_for_control",
    type: "tradeoff",
    text: "Restricting the pop-up to advance reservations reduces spontaneity, but it keeps the satellite inventory small and makes missing-item checks practical.",
    label: "The plan trades spontaneous borrowing for simpler inventory control.",
  },
  {
    id: "tradeoff_transfer_trips",
    type: "tradeoff",
    text: "The plan also accepts two weekly transfer trips in exchange for avoiding a permanent duplicate stock.",
    label: "Two weekly transfer trips are accepted to avoid duplicate permanent stock.",
  },
  {
    id: "rejected_alternative_delivery",
    type: "rejected_alternative",
    text: "Home delivery was rejected because a driver route would require vehicle insurance, address handling, and unpredictable travel time for each rental.",
    label: "Home delivery is rejected because it adds insurance, data-handling, and route costs.",
  },
  {
    id: "rejected_alternative_storefront",
    type: "rejected_alternative",
    text: "A full second storefront was also rejected for now because rent and duplicate storage would consume most of the reserve before demand at the new location is demonstrated.",
    label: "A permanent storefront is rejected until demand justifies its fixed costs.",
  },
];

export function caseAnalysisDemoGraph(sourceText: string): ClaimGraph {
  return graphFromExactSpans(sourceText, caseAnalysisNodes, [
    { source: "assumption_staff_capacity", target: "recommendation_pop_up_pilot", type: "depends_on" },
    { source: "tradeoff_reservations_for_control", target: "recommendation_pop_up_pilot", type: "supports" },
    { source: "tradeoff_transfer_trips", target: "recommendation_pop_up_pilot", type: "undermines" },
    { source: "rejected_alternative_delivery", target: "recommendation_pop_up_pilot", type: "supports" },
    { source: "rejected_alternative_storefront", target: "recommendation_pop_up_pilot", type: "supports" },
    { source: "recommendation_exit_metrics", target: "recommendation_pop_up_pilot", type: "depends_on" },
  ], "case_analysis");
}
