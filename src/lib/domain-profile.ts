import { z } from "zod";
import { essayProfile } from "@profiles/essay";
import { codeProfile } from "@profiles/code";

export const profileIdSchema = z.enum(["essay", "code"]);
export type ProfileId = z.infer<typeof profileIdSchema>;
export type DomainProfile = {
  readonly id: ProfileId;
  readonly artifact_noun: string;
  readonly node_types: readonly [string, string, string];
  readonly edge_types: readonly [string, string, string];
  readonly probe_framing: string;
  readonly dossier_vocab: {
    readonly claims_defended: string;
    readonly understanding_map: string;
  };
  readonly fixture: string;
};

const profiles = { essay: essayProfile, code: codeProfile } satisfies Record<ProfileId, DomainProfile>;

export function getDomainProfile(profileId: ProfileId = "essay") {
  return profiles[profileId];
}

export function claimGraphVocabularyBlock(profile: DomainProfile) {
  if (profile.id === "code") return codeClaimGraphVocabularyBlock(profile);
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
