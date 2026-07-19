import type { ClaimGraph } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import type { ProfileId } from "@/lib/domain-profile";

export type UnderstandingStatus = "examined" | "being_examined" | "not_yet_examined";

export function understandingMapState(graph: ClaimGraph, decisionLog: DecisionLogEntry[], profileId: ProfileId = "essay") {
  void profileId;
  const claims = [...graph.nodes].sort((a, b) => a.source_span.start - b.source_span.start || a.source_span.end - b.source_span.end);
  const ordered = [...decisionLog].sort((a, b) => a.sequence - b.sequence);
  const latest = ordered.at(-1);
  const adequatelyDefended = new Set(ordered.filter((entry) => entry.assessment === "strong").map((entry) => entry.target_claim_id));
  return claims.map((claim, index) => ({
    claim,
    index,
    status: latest?.next_claim_id === claim.id
      ? "being_examined" as const
      : adequatelyDefended.has(claim.id)
        ? "examined" as const
        : "not_yet_examined" as const,
  }));
}
