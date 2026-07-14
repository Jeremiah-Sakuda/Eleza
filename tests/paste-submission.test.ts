import assert from "node:assert/strict";
import test from "node:test";
import type { ClaimGraph } from "../src/lib/claim-graph";
import { countWords, PASTE_SCOPE_MESSAGE, validatePasteGraph, validatePasteLength } from "../src/lib/paste-submission";

test("paste length accepts 250 through 1200 words and rejects both boundaries", () => {
  assert.equal(validatePasteLength(Array.from({ length: 250 }, () => "word").join(" ")), 250);
  assert.equal(validatePasteLength(Array.from({ length: 1_200 }, () => "word").join(" ")), 1_200);
  assert.throws(() => validatePasteLength(Array.from({ length: 249 }, () => "word").join(" ")), /at least 250 words/);
  assert.throws(() => validatePasteLength(Array.from({ length: 1_201 }, () => "word").join(" ")), /1,200 words or fewer/);
  assert.equal(countWords("  one\n two   three "), 3);
});

test("paste graph requires four real claim nodes before a viva can start", () => {
  const graph = (claimCount: number): ClaimGraph => ({
    nodes: Array.from({ length: claimCount }, (_, index) => ({ id: `claim_${index}`, type: "claim", label: `Claim ${index} label`, source_span: { start: index, end: index + 1 } })),
    edges: [],
  });
  assert.equal(validatePasteGraph(graph(4)).nodes.length, 4);
  assert.throws(() => validatePasteGraph(graph(3)), new RegExp(PASTE_SCOPE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
