import { z } from "zod";
import { essayProfile } from "@profiles/essay";

export const profileIdSchema = z.enum(["essay"]);
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

const profiles = { essay: essayProfile } satisfies Record<ProfileId, DomainProfile>;

export function getDomainProfile(profileId: ProfileId = "essay") {
  return profiles[profileId];
}

export function claimGraphVocabularyBlock(profile: DomainProfile) {
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
