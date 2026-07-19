export const caseAnalysisProfile = {
  id: "case_analysis",
  artifact_noun: "case analysis",
  node_types: ["recommendation", "assumption", "tradeoff", "rejected_alternative"],
  examinable_node_types: ["recommendation", "assumption", "tradeoff", "rejected_alternative"],
  edge_types: ["supports", "undermines", "depends_on"],
  probe_framing: [
    "- `strong`: the answer reconstructs the recommendation, identifies the assumptions it depends on, and explains its tradeoffs against a rejected alternative.",
    "- `partial`: the answer supports the recommendation but omits a material assumption, consequence, or alternative.",
    "- `unsupported`: the answer repeats the recommendation or cannot identify which assumption, if wrong, would break it.",
    "- `contradictory`: the spoken answer conflicts with the target recommendation, assumption, tradeoff, rejected alternative, or graph.",
    "- `off_topic`: the answer does not address the target case-analysis node.",
    "- `probe`: stay on the target and ask which assumption, if wrong, breaks the recommendation or how the tradeoff changes under pressure.",
    "- `branch`: move to a connected node when the answer exposes a dependency, undermining assumption, or rejected alternative.",
    "- `advance`: move to another examinable node only when the current recommendation or assumption has been adequately stress-tested.",
    "- `next_claim_id` is the case-analysis node targeted by `next_question`. For `probe`, it must equal `target_claim_id`. For `branch`, it must be directly connected to the target in the graph. For `advance`, select another examinable case-analysis node that logically follows.",
  ].join("\n"),
  dossier_vocab: {
    claims_defended: "ASSUMPTIONS DEFENDED",
    understanding_map: "UNDERSTANDING MAP",
  },
  fixture: "fixtures/case-expansion-memo.txt",
} as const;

export type CaseAnalysisProfile = typeof caseAnalysisProfile;
