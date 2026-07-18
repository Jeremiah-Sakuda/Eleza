"use client";

import { useEffect, useRef, useState } from "react";
import type { ClaimGraph, ClaimGraphNode } from "@/lib/claim-graph";
import type { ProfileId } from "@/lib/domain-profile";

type Result = {
  sourceText: string;
  graph: ClaimGraph;
  persistence: { persisted: boolean; submissionId?: string; graphId?: string; profileId: ProfileId };
};
type InspectionHandoff = { title: string; sourceKind: "paste"; durationMs: number; profileId: ProfileId; judgeAccessCode?: string; result: Result };

const colors = {
  claim: "#3455db", evidence: "#16836d", citation: "#9b5f18",
  design_decision: "#1e6b4e", implementation: "#4f5966", assumption: "#9b5f18",
} as const;

export default function InspectionPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<ClaimGraphNode | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [handoff, setHandoff] = useState<InspectionHandoff | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("eleza:inspection-handoff");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as InspectionHandoff;
      setHandoff(parsed);
      setResult(parsed.result);
    } catch {
      setError("The pasted argument could not be loaded. Return to the demo and map it again.");
    }
  }, []);

  async function generate(upload: File) {
    setLoading(true); setError(""); setResult(null); setSelected(null); setHandoff(null);
    const form = new FormData(); form.append("file", upload);
    try {
      const response = await fetch("/api/claim-graph", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed."); }
    finally { setLoading(false); }
  }

  async function useFixture() {
    const response = await fetch("/api/fixture");
    const fixture = await response.json();
    const sample = new File([fixture.sourceText], fixture.filename, { type: "text/plain" });
    setFile(sample); await generate(sample);
  }

  function proceedToViva(deliveryMode: "voice" | "text") {
    if (!result) return;
    sessionStorage.setItem("eleza:viva-handoff", JSON.stringify({
      title: handoff?.title ?? file?.name.replace(/\.(txt|pdf)$/i, "") ?? "Argumentative submission",
      sourceText: result.sourceText,
      graph: result.graph,
      submissionId: result.persistence.submissionId,
      durationMs: handoff?.durationMs ?? 300_000,
      deliveryMode,
      practice: false,
      sourceKind: handoff?.sourceKind,
      profileId: handoff?.profileId ?? result.persistence.profileId,
      judgeAccessCode: handoff?.judgeAccessCode,
    }));
    window.location.assign("/viva");
  }

  return <><nav className="masthead"><div><a href="/" className="wordmark">ELEZA</a><i /><span className="mast-title">Claim graph inspection</span></div><span className="stage">PRE-VIVA</span></nav><main>
    <header><p className="eyebrow">SUBMISSION / ARGUMENT MAP</p><h1>Inspect the argument<br />before the conversation.</h1><p className="lede">Upload an argumentative submission. Eleza maps claims to the exact document spans that will anchor its oral defense.</p></header>
    <section className="upload" aria-label="Submission upload">
      <label className="picker"><input ref={fileInput} type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><span>{file ? file.name : "Choose a .txt or .pdf"}</span></label>
      <button disabled={!file || loading} onClick={() => file && generate(file)}>{loading ? "Mapping argument…" : "Generate claim graph"}</button>
      <button className="quiet" disabled={loading} onClick={useFixture}>Use synthetic sample</button>
    </section>
    {error && <p className="error" role="alert">{error}</p>}
    {result && <div className="phase-toolbar"><span>{result.graph.nodes.length} nodes</span><span>{result.graph.edges.length} edges</span><button onClick={() => proceedToViva("voice")}>Proceed by voice</button><button className="quiet" onClick={() => proceedToViva("text")}>Proceed by text</button></div>}
    {result && <section className="workspace">
      <div className="panel graph-panel"><div className="panel-heading"><div><p className="eyebrow">CLAIM GRAPH</p><h2>{result.graph.nodes.filter((node) => node.type === "claim").length} claims · {result.graph.nodes.length} anchored nodes</h2></div><span className="status">{result.persistence.persisted ? "Saved" : "Local demo"}</span></div>
        <Graph graph={result.graph} selectedId={selected?.id} onSelect={setSelected} />
        <p className="legend"><i style={{ background: colors.claim }} /> claim <i style={{ background: colors.evidence }} /> evidence <i style={{ background: colors.citation }} /> citation</p>
      </div>
      <article className="panel document"><div className="panel-heading"><div><p className="eyebrow">SOURCE DOCUMENT</p><h2>Click a node to trace its receipt</h2></div></div><DocumentText text={result.sourceText} node={selected} /></article>
    </section>}
  </main></>;
}

function Graph({ graph, selectedId, onSelect }: { graph: ClaimGraph; selectedId?: string; onSelect: (node: ClaimGraphNode) => void }) {
  return <div className="graph" role="list" aria-label="Claim graph nodes">
    {graph.nodes.map((node, index) => <button key={node.id} role="listitem" className={`node ${selectedId === node.id ? "selected" : ""}`} style={{ borderColor: colors[node.type], gridColumn: (index % 2) + 1 }} onClick={() => onSelect(node)}>
      <small>{node.type} · {node.id}</small><span>{node.label}</span>
    </button>)}
    <div className="edge-summary">{graph.edges.map((edge) => <span key={`${edge.source}-${edge.target}`}>{edge.source} <b>{edge.type.replace("_", " ")}</b> {edge.target}</span>)}</div>
  </div>;
}

function DocumentText({ text, node }: { text: string; node: ClaimGraphNode | null }) {
  if (!node) return <div className="document-text">{text}</div>;
  const { start, end } = node.source_span;
  return <div className="document-text">{text.slice(0, start)}<mark>{text.slice(start, end)}</mark>{text.slice(end)}<p className="receipt">Selected: <code>{node.id}</code> · characters {start}–{end}</p></div>;
}
