export const essayProfile = {
  id: "essay",
  artifact_noun: "submission",
  node_types: ["claim", "evidence", "citation"],
  edge_types: ["supports", "rebuts", "depends_on"],
  probe_framing: [
    "- `strong`: the answer reconstructs the claim's mechanism or evidence accurately.",
    "- `partial`: the answer has relevant content but omits an important mechanism or dependency.",
    "- `unsupported`: the answer restates a conclusion, evades the mechanism, or cannot supply the claimed evidence.",
    "- `contradictory`: the spoken answer conflicts with the target claim or graph.",
    "- `off_topic`: the answer does not address the target claim.",
    "- `probe`: stay on the target claim and ask for the missing mechanism, evidence, or reconciliation.",
    "- `branch`: move to a connected claim when the answer exposes a relevant dependency or contradiction.",
    "- `advance`: move to the next claim only when the current claim has been adequately reconstructed.",
    "- `next_claim_id` is the claim node targeted by `next_question`. For `probe`, it must equal `target_claim_id`. For `branch`, it must be directly connected to the target in the graph. For `advance`, select another claim node that logically follows.",
  ].join("\n"),
  dossier_vocab: {
    claims_defended: "CLAIMS DEFENDED",
    understanding_map: "UNDERSTANDING MAP",
  },
  fixture: "fixtures/community-gardens-argument.txt",
} as const;

export type EssayProfile = typeof essayProfile;
