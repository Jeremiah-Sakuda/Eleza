import type { ClaimGraph } from "@/lib/claim-graph";

export const PASTE_MIN_WORDS = 250;
export const PASTE_MAX_WORDS = 1_200;
export const PASTE_SCOPE_MESSAGE = "This text does not have enough argumentative structure to examine. Eleza works best on writing that makes a position and supports it with several distinct claims.";

export function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function validatePasteLength(text: string) {
  const words = countWords(text);
  if (words < PASTE_MIN_WORDS) {
    throw new Error(`Paste at least ${PASTE_MIN_WORDS} words so there is enough argument to examine.`);
  }
  if (words > PASTE_MAX_WORDS) {
    throw new Error(`Keep the pasted text to ${PASTE_MAX_WORDS.toLocaleString("en-US")} words or fewer.`);
  }
  return words;
}

export function validatePasteGraph(graph: ClaimGraph) {
  if (graph.nodes.filter((node) => node.type === "claim").length < 4) throw new Error(PASTE_SCOPE_MESSAGE);
  return graph;
}
