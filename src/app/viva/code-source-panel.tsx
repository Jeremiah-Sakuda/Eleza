"use client";

import { useEffect, useRef, useState } from "react";
import type { ClaimGraph } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";

type Leader = { id: string; path: string };

export function CodeSourcePanel({ sourceText, graph, activeTargetId, decisionLog }: {
  sourceText: string;
  graph: ClaimGraph;
  activeTargetId?: string;
  decisionLog: DecisionLogEntry[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const lines = toLines(sourceText);
  const examinedIds = new Set(decisionLog.map((entry) => entry.target_claim_id));

  useEffect(() => {
    const element = root.current;
    const main = element?.closest(".viva-main");
    if (!element || !(main instanceof HTMLElement)) return;
    const measure = () => {
      // DECISION: leader geometry is derived from source-span and decision-log DOM receipts, never stored as a second routing state.
      const mainBox = main.getBoundingClientRect();
      const next = decisionLog.flatMap((entry) => {
        const anchor = element.querySelector<HTMLElement>(`[data-code-node~="${entry.target_claim_id}"]`);
        const note = main.querySelector<HTMLElement>(`[data-decision-id="${entry.id}"]`);
        if (!anchor || !note) return [];
        const anchorBox = anchor.getBoundingClientRect();
        const noteBox = note.getBoundingClientRect();
        const x1 = anchorBox.left - mainBox.left + 45;
        const y1 = anchorBox.top - mainBox.top + anchorBox.height / 2;
        const x2 = noteBox.left - mainBox.left - 14;
        const y2 = noteBox.top - mainBox.top + 14;
        return [{ id: entry.id, path: `M ${x1} ${y1} L ${x1 + 24} ${y1} L ${x2} ${y2}` }];
      });
      setLeaders(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [decisionLog]);

  return <div className="code-source" ref={root}>
    <div className="code-source-heading"><p className="column-label">SUBMITTED PROGRAM</p><span>{lines.length} LINES · PYTHON</span></div>
    <pre aria-label="Submitted Python program">
      {lines.map((line) => {
        const nodes = graph.nodes.filter((node) => node.source_span.start < line.end && node.source_span.end > line.start);
        const nodeIds = nodes.map((node) => node.id).join(" ");
        const active = nodes.some((node) => node.id === activeTargetId);
        const examined = nodes.some((node) => examinedIds.has(node.id));
        const commentAt = line.text.indexOf("#");
        return <span className={`code-line ${active ? "active" : examined ? "examined" : ""}`} data-code-node={nodeIds || undefined} key={line.number}>
          <span className="code-line-number">{line.number}</span>
          <i aria-hidden="true" />
          <code>{commentAt < 0 ? line.text : <>{line.text.slice(0, commentAt)}<span className="code-comment">{line.text.slice(commentAt)}</span></>}</code>
        </span>;
      })}
    </pre>
    <svg className="code-leader-lines" aria-hidden="true">
      {leaders.map((leader) => <path key={leader.id} d={leader.path} pathLength="1" />)}
    </svg>
  </div>;
}

function toLines(sourceText: string) {
  let offset = 0;
  const split = sourceText.split("\n");
  if (split.at(-1) === "") split.pop();
  return split.map((text, index) => {
    const start = offset;
    offset += text.length + 1;
    return { number: index + 1, text, start, end: offset };
  });
}
