export const labReportProfile = {
  id: "lab_report",
  artifact_noun: "lab report",
  node_types: ["hypothesis", "method_choice", "interpretation", "conclusion"],
  examinable_node_types: ["hypothesis", "method_choice", "interpretation", "conclusion"],
  edge_types: ["supports", "tests", "depends_on"],
  probe_framing: [
    "- `strong`: the answer connects the reported result to the interpretation, names what outcome would have challenged the hypothesis, and justifies material controls or method choices.",
    "- `partial`: the answer identifies relevant results but omits an evidentiary link, falsifying outcome, control, or limitation.",
    "- `unsupported`: the answer repeats the conclusion, cannot explain why the result supports it, or cannot justify the named control or method choice.",
    "- `contradictory`: the spoken answer conflicts with the target hypothesis, method, interpretation, conclusion, or graph.",
    "- `off_topic`: the answer does not address the target lab-report node.",
    "- `probe`: stay on the target and ask why the result supports that interpretation, what outcome would have falsified the hypothesis, or why the control was needed.",
    "- `branch`: move to a connected node when the answer exposes a relevant result, control, dependency, or overreach.",
    "- `advance`: move to another examinable node only when the current evidentiary link and its limits have been adequately reconstructed.",
    "- `next_claim_id` is the lab-report node targeted by `next_question`. For `probe`, it must equal `target_claim_id`. For `branch`, it must be directly connected to the target in the graph. For `advance`, select another examinable lab-report node that logically follows.",
  ].join("\n"),
  dossier_vocab: {
    claims_defended: "INTERPRETATIONS DEFENDED",
    understanding_map: "UNDERSTANDING MAP",
  },
  fixture: "fixtures/lab-photosynthesis-report.txt",
} as const;

export type LabReportProfile = typeof labReportProfile;
