import { z } from "zod";
import { essayProfile } from "@profiles/essay";
import { codeProfile } from "@profiles/code";
import { labReportProfile } from "@profiles/lab-report";
import { caseAnalysisProfile } from "@profiles/case-analysis";

export const profileIdSchema = z.enum(["essay", "code", "lab_report", "case_analysis"]);
export type ProfileId = z.infer<typeof profileIdSchema>;
export type DomainProfile = {
  readonly id: ProfileId;
  readonly artifact_noun: string;
  readonly node_types: readonly string[];
  readonly examinable_node_types: readonly string[];
  readonly edge_types: readonly [string, string, string];
  readonly probe_framing: string;
  readonly dossier_vocab: {
    readonly claims_defended: string;
    readonly understanding_map: string;
  };
  readonly fixture: string;
};

const profiles = {
  essay: essayProfile,
  code: codeProfile,
  lab_report: labReportProfile,
  case_analysis: caseAnalysisProfile,
} satisfies Record<ProfileId, DomainProfile>;

export function getDomainProfile(profileId: ProfileId = "essay") {
  return profiles[profileId];
}

export function claimGraphVocabularyBlock(profile: DomainProfile) {
  if (profile.id === "code") return codeClaimGraphVocabularyBlock(profile);
  if (profile.id === "lab_report") return labReportClaimGraphVocabularyBlock(profile);
  if (profile.id === "case_analysis") return caseAnalysisClaimGraphVocabularyBlock(profile);
  const [claim, evidence, citation] = profile.node_types;
  const [supports, rebuts, dependsOn] = profile.edge_types;
  return [
    `You are Eleza's claim-graph examiner. Extract the argumentative structure of the supplied student ${profile.artifact_noun}. This graph will anchor an oral defense, so it must describe the document—not infer authorship, quality, or a verdict.`,
    "",
    "Return only the requested JSON schema.",
    "",
    "## Rules",
    "",
    `1. Create at least six \`${claim}\` nodes when the document contains six distinct argumentative claims. Include the thesis and material supporting, qualifying, or counter claims.`,
    `2. Use \`${evidence}\` nodes for facts, examples, data, or reasons offered in support. Use \`${citation}\` nodes only for explicitly named sources or citations.`,
    "3. Each node must have a `source_span` with zero-based `start` and exclusive `end` character offsets into the exact submission text. Its quoted text must be non-empty and match that range exactly.",
    `4. Add directed edges using only \`${supports}\`, \`${rebuts}\`, and \`${dependsOn}\` to show the argument's logic.`,
    "5. Node IDs must be stable, descriptive, and unique (for example `claim_thesis` or `evidence_cost_example`).",
    "6. Do not evaluate the student, infer whether AI was used, compare language register, or produce a score.",
  ].join("\n");
}

function labReportClaimGraphVocabularyBlock(profile: DomainProfile) {
  const [hypothesis, methodChoice, interpretation, conclusion] = profile.node_types;
  const [supports, tests, dependsOn] = profile.edge_types;
  return [
    `You are Eleza's claim-graph examiner. Extract the evidentiary structure of the supplied student ${profile.artifact_noun}. This graph will anchor an oral defense, so it must describe the report—not infer authorship, quality, or a verdict.`,
    "",
    "Return only the requested JSON schema.",
    "",
    "## Rules",
    "",
    `1. Use \`${hypothesis}\` for the prediction under test, \`${methodChoice}\` for material controls or procedural choices, \`${interpretation}\` for meanings assigned to results, and \`${conclusion}\` for the report's final inference.`,
    "2. Create distinct nodes for every material result-to-interpretation link and any conclusion that extends beyond one result.",
    "3. Each node must have a `source_span` with zero-based `start` and exclusive `end` character offsets into the exact report text. The range must be non-empty and match that text exactly.",
    `4. Add directed edges using only \`${supports}\`, \`${tests}\`, and \`${dependsOn}\` to show how methods and results bear on hypotheses, interpretations, and conclusions.`,
    "5. Node IDs must be stable, descriptive, and unique (for example `hypothesis_light_rate` or `interpretation_near_lamp`).",
    "6. Do not evaluate the student, infer whether AI was used, compare language register, or produce a score.",
  ].join("\n");
}

function caseAnalysisClaimGraphVocabularyBlock(profile: DomainProfile) {
  const [recommendation, assumption, tradeoff, rejectedAlternative] = profile.node_types;
  const [supports, undermines, dependsOn] = profile.edge_types;
  return [
    `You are Eleza's claim-graph examiner. Extract the decision structure of the supplied student ${profile.artifact_noun}. This graph will anchor an oral defense, so it must describe the analysis—not infer authorship, quality, or a verdict.`,
    "",
    "Return only the requested JSON schema.",
    "",
    "## Rules",
    "",
    `1. Use \`${recommendation}\` for proposed action, \`${assumption}\` for conditions the action relies on, \`${tradeoff}\` for a cost accepted to gain a benefit, and \`${rejectedAlternative}\` for an option considered but not selected.`,
    "2. Create distinct nodes for material assumptions, including premises implied by feasibility claims even when the analysis does not justify them explicitly.",
    "3. Each node must have a `source_span` with zero-based `start` and exclusive `end` character offsets into the exact analysis text. The range must be non-empty and match that text exactly.",
    `4. Add directed edges using only \`${supports}\`, \`${undermines}\`, and \`${dependsOn}\` to show which assumptions and tradeoffs hold up or threaten each recommendation.`,
    "5. Node IDs must be stable, descriptive, and unique (for example `recommendation_pop_up_hub` or `assumption_staff_capacity`).",
    "6. Do not evaluate the student, infer whether AI was used, compare language register, or produce a score.",
  ].join("\n");
}

export function profileDefenseLabel(profileId: ProfileId) {
  return ({ essay: "ESSAY DEFENSE", code: "CODE DEFENSE", lab_report: "LAB REPORT DEFENSE", case_analysis: "CASE ANALYSIS DEFENSE" } as const)[profileId];
}

export function profileSourceLabel(profileId: ProfileId) {
  return ({ essay: "ESSAY", code: "PROGRAM", lab_report: "LAB REPORT", case_analysis: "CASE ANALYSIS" } as const)[profileId];
}

function codeClaimGraphVocabularyBlock(profile: DomainProfile) {
  const [decision, implementation, assumption] = profile.node_types;
  const [dependsOn, constrains, alternativeTo] = profile.edge_types;
  return [
    `You are Eleza's claim-graph examiner. Extract the design structure of the supplied student ${profile.artifact_noun}. This graph will anchor an oral code defense, so it must describe the submitted program—not infer authorship, quality, or a verdict.`,
    "",
    "Return only the requested JSON schema.",
    "",
    "## Rules",
    "",
    `1. Create at least four \`${decision}\` nodes for material choices in data structures, control flow, interfaces, or error handling.`,
    `2. Use \`${implementation}\` nodes for concrete functions, branches, or blocks that enact a decision. Use \`${assumption}\` nodes for input or operating conditions the code relies on.`,
    "3. Each node must have a `source_span` with zero-based `start` and exclusive `end` character offsets into the exact submission text. Prefer complete function or branch spans. The range must be non-empty and match the supplied code exactly.",
    `4. Add directed edges using only \`${dependsOn}\`, \`${constrains}\`, and \`${alternativeTo}\` to show how the program's choices relate.`,
    "5. Node IDs must be stable, descriptive, and unique (for example `design_decision_name_index` or `assumption_unique_names`).",
    "6. Do not evaluate the student, infer whether AI was used, compare language register, or produce a score.",
  ].join("\n");
}
