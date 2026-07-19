export const codeProfile = {
  id: "code",
  artifact_noun: "submission",
  node_types: ["design_decision", "implementation", "assumption"],
  examinable_node_types: ["design_decision"],
  edge_types: ["depends_on", "constrains", "alternative_to"],
  probe_framing: [
    "- `strong`: the answer justifies the design decision, reconstructs how the implementation works, and identifies relevant failure modes.",
    "- `partial`: the answer describes relevant code but omits an important justification, constraint, or failure mode.",
    "- `unsupported`: the answer restates what the code does, evades why the structure was chosen, or cannot explain what breaks for the named input.",
    "- `contradictory`: the spoken answer conflicts with the target decision, implementation, assumption, or graph.",
    "- `off_topic`: the answer does not address the target decision.",
    "- `probe`: stay on the target decision and ask why this structure was chosen, what breaks if a constraint changes, or what alternative was rejected.",
    "- `branch`: move to a connected decision when the answer exposes a relevant dependency, constraint, or alternative.",
    "- `advance`: move to the next design decision only when the current decision and its failure modes have been adequately reconstructed.",
    "- `next_claim_id` is the design-decision node targeted by `next_question`. For `probe`, it must equal `target_claim_id`. For `branch`, it must be directly connected to the target in the graph. For `advance`, select another design-decision node that logically follows.",
  ].join("\n"),
  dossier_vocab: {
    claims_defended: "DECISIONS DEFENDED",
    understanding_map: "UNDERSTANDING MAP",
  },
  fixture: "fixtures/code-inventory-tracker.py",
} as const;

export type CodeProfile = typeof codeProfile;
