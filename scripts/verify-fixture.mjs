import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const fixtureUrl = process.argv[2]
  ? pathToFileURL(path.resolve(process.argv[2]))
  : new URL("../fixtures/community-gardens-argument.txt", import.meta.url);
const filename = path.basename(fileURLToPath(fixtureUrl));
const fixtureBytes = await readFile(fixtureUrl);
const isPdf = filename.toLowerCase().endsWith(".pdf");
const expectedText = isPdf ? null : fixtureBytes.toString("utf8");

async function generate() {
  const form = new FormData();
  form.append("file", new Blob([fixtureBytes], { type: isPdf ? "application/pdf" : "text/plain" }), filename);
  const response = await fetch("http://127.0.0.1:3000/api/claim-graph", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Fixture request failed.");
  return result;
}

const firstResult = await generate();
const secondResult = await generate();
const first = firstResult.graph;
const second = secondResult.graph;
const sourceText = firstResult.sourceText;
if (expectedText && sourceText.trim() !== expectedText.trim()) throw new Error("Text extraction changed the fixture contents.");
const claimCount = first.nodes.filter((node) => node.type === "claim").length;
const spansAreReal = first.nodes.every((node) => {
  const { start, end } = node.source_span;
  return start >= 0 && end <= sourceText.length && start < end && sourceText.slice(start, end).trim().length > 0;
});
const signature = (graph) => JSON.stringify({
  nodes: graph.nodes.map(({ id, type }) => ({ id, type })),
  edges: graph.edges,
});

if (claimCount < 6) throw new Error(`Expected at least 6 claims, received ${claimCount}.`);
if (!spansAreReal) throw new Error("At least one graph node does not map to a real source span.");
if (signature(first) !== signature(second)) throw new Error("Fixture graph structure changed between runs.");

console.log(`Verified ${claimCount} claims, ${first.nodes.length} anchored nodes, ${first.edges.length} edges, and deterministic structure.`);
