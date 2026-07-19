"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClaimGraph } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import { profileSourceLabel, type ProfileId } from "@/lib/domain-profile";

type Leader = { id: string; path: string };

export function ProseSourcePanel({ sourceText, graph, activeTargetId, decisionLog, profileId }: {
  sourceText: string;
  graph: ClaimGraph;
  activeTargetId?: string;
  decisionLog: DecisionLogEntry[];
  profileId: Exclude<ProfileId, "code">;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [leader, setLeader] = useState<Leader>();
  const latestReceipt = [...decisionLog].sort((a, b) => a.sequence - b.sequence).at(-1);
  const visibleNodeIds = useMemo(
    () => new Set([activeTargetId, latestReceipt?.target_claim_id].filter((id): id is string => Boolean(id))),
    [activeTargetId, latestReceipt?.target_claim_id],
  );
  const segments = useMemo(() => segmentSource(sourceText, graph, visibleNodeIds), [graph, sourceText, visibleNodeIds]);

  useEffect(() => {
    const element = root.current;
    const main = element?.closest(".viva-main");
    if (!element || !(main instanceof HTMLElement) || !latestReceipt) {
      setLeader(undefined);
      return;
    }
    const measure = () => {
      // DECISION: prose leader geometry is derived from the active source span and append-only receipt DOM, never persisted as routing state.
      const anchor = [...element.querySelectorAll<HTMLElement>("[data-prose-node]")]
        .find((candidate) => candidate.dataset.proseNode?.split(" ").includes(latestReceipt.target_claim_id));
      const note = main.querySelector<HTMLElement>(`[data-decision-id="${latestReceipt.id}"]`);
      if (!anchor || !note) {
        setLeader(undefined);
        return;
      }
      const mainBox = main.getBoundingClientRect();
      const panelBox = element.getBoundingClientRect();
      const anchorBox = anchor.getBoundingClientRect();
      const noteBox = note.getBoundingClientRect();
      const x1 = panelBox.right - mainBox.left + 6;
      const y1 = anchorBox.top - mainBox.top + anchorBox.height / 2;
      const x2 = noteBox.left - mainBox.left - 14;
      const y2 = noteBox.top - mainBox.top + 14;
      const gutter = x1 + Math.max(10, (x2 - x1) / 2);
      setLeader({ id: latestReceipt.id, path: `M ${x1} ${y1} L ${gutter} ${y1} L ${gutter} ${y2} L ${x2} ${y2}` });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(main);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [latestReceipt]);

  const wordCount = sourceText.trim().split(/\s+/).filter(Boolean).length;
  return <div className="prose-source" ref={root}>
    <div className="prose-source-heading">
      <p className="column-label">SUBMITTED {profileSourceLabel(profileId)}</p>
      <span>{wordCount} WORDS</span>
    </div>
    <div className="prose-source-text" aria-label={`Submitted ${profileSourceLabel(profileId).toLowerCase()}`}>
      {segments.map((segment) => <span
        className={segment.nodeIds.includes(activeTargetId ?? "") ? "active" : segment.nodeIds.length > 0 ? "receipt-span" : undefined}
        data-prose-node={segment.nodeIds.join(" ") || undefined}
        key={`${segment.start}-${segment.end}`}
      >{segment.text}</span>)}
    </div>
    {leader && <svg className="prose-leader-lines" aria-hidden="true"><path d={leader.path} pathLength="1" /></svg>}
  </div>;
}

function segmentSource(sourceText: string, graph: ClaimGraph, visibleNodeIds: Set<string>) {
  const nodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id));
  const boundaries = new Set([0, sourceText.length]);
  for (const node of nodes) {
    boundaries.add(node.source_span.start);
    boundaries.add(node.source_span.end);
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  return ordered.slice(0, -1).map((start, index) => {
    const end = ordered[index + 1];
    return {
      start,
      end,
      text: sourceText.slice(start, end),
      nodeIds: nodes.filter((node) => node.source_span.start < end && node.source_span.end > start).map((node) => node.id),
    };
  });
}
