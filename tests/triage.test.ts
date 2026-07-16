import assert from "node:assert/strict";
import test from "node:test";
import { formatFindingTypeSummary } from "../src/lib/dossier-store";
import { divergenceFindingSchema } from "../src/lib/divergence-schema";

function finding(type: "cannot_reconstruct" | "mechanism_gap" | "inconsistency", timestamp: number) {
  return divergenceFindingSchema.parse({
    timestamp,
    transcript_excerpt: "A specific transcript receipt.",
    claim_id: `claim_${type}`,
    doc_span: { start: 0, end: 20 },
    type,
    note: "A specific evidence note for this finding receipt.",
  });
}

test("triage summarizes finding types in stable inline order", () => {
  assert.equal(formatFindingTypeSummary([
    finding("inconsistency", 1),
    finding("mechanism_gap", 2),
    finding("mechanism_gap", 3),
  ]), "2 mechanism_gap, 1 inconsistency");
  assert.equal(formatFindingTypeSummary([]), "");
});
