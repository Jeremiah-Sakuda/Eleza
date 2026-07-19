"use client";

import { useState } from "react";
import type { ClaimGraph } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import { understandingMapState } from "@/lib/understanding-map";
import { getDomainProfile, type ProfileId } from "@/lib/domain-profile";

type MapState = ReturnType<typeof understandingMapState>;
type PlacedNode = MapState[number] & {
  x: number;
  y: number;
  width: number;
  height: number;
  tierIndex: number;
  rowIndex: number;
  tierRowCount: number;
  exhibitLabel: string;
  displayedId: string;
};

export function UnderstandingMap({ graph, decisionLog, compact = false, profileId = "essay" }: { graph: ClaimGraph; decisionLog: DecisionLogEntry[]; compact?: boolean; profileId?: ProfileId }) {
  const [focusedNodeId, setFocusedNodeId] = useState<string>();
  const profile = getDomainProfile(profileId);
  const state = understandingMapState(graph, decisionLog, profileId);
  const layout = buildTieredLayout(state, profile.node_types, compact);
  const positions = new Map(layout.nodes.map((node) => [node.claim.id, node]));

  return <figure className={`understanding-map ${compact ? "compact" : "dossier-map"}`}>
    <figcaption>{profile.dossier_vocab.understanding_map}</figcaption>
    <div className="understanding-map-canvas">
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label="Graph coverage from examiner decisions">
        <g className="understanding-edges">
          {graph.edges.flatMap((edge) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return [];
            const route = routeEdge(source, target, layout.width);
            const incident = focusedNodeId === edge.source || focusedNodeId === edge.target;
            return <path
              className={`${route.clean ? "clean" : "contextual"} ${incident ? "visible" : ""}`}
              data-source={edge.source}
              data-target={edge.target}
              d={route.path}
              key={`${edge.source}-${edge.target}-${edge.type}`}
            />;
          })}
        </g>
        {layout.nodes.map((node) => <g
          aria-label={`${node.exhibitLabel}, ${node.claim.id}, ${node.status.replaceAll("_", " ")}`}
          className={`understanding-node ${node.status}`}
          data-node-id={node.claim.id}
          key={node.claim.id}
          onBlur={() => setFocusedNodeId(undefined)}
          onFocus={() => setFocusedNodeId(node.claim.id)}
          onMouseEnter={() => setFocusedNodeId(node.claim.id)}
          onMouseLeave={() => setFocusedNodeId(undefined)}
          tabIndex={0}
          transform={`translate(${node.x} ${node.y})`}
        >
          <title>{`${node.exhibitLabel} · ${node.claim.id}`}</title>
          <rect width={node.width} height={node.height} rx="1" />
          <text x="7" y="15">{node.exhibitLabel}</text>
          <text className="understanding-node-id" x="7" y="31">{node.displayedId}</text>
        </g>)}
      </svg>
    </div>
    <div className="understanding-legend"><span><i className="examined" />examined</span><span><i className="being_examined" />being examined</span><span><i className="not_yet_examined" />not yet examined</span></div>
  </figure>;
}

function buildTieredLayout(state: MapState, profileNodeTypes: readonly string[], compact: boolean) {
  const columns = compact ? 2 : 4;
  const horizontalGap = compact ? 10 : 14;
  const rowGap = 9;
  const tierGap = compact ? 24 : 30;
  const nodeHeight = 40;
  const orderedTypes = [...profileNodeTypes, ...new Set(state.map(({ claim }) => claim.type).filter((type) => !profileNodeTypes.includes(type)))];
  const documentIndex = new Map(state.map(({ claim }, index) => [claim.id, index]));
  const nodes: PlacedNode[] = [];
  let y = 4;
  let width = compact ? 256 : 620;
  let visibleTierIndex = 0;

  for (const type of orderedTypes) {
    const tierNodes = state.filter(({ claim }) => claim.type === type);
    if (tierNodes.length === 0) continue;
    const tierRowCount = Math.ceil(tierNodes.length / columns);
    for (let rowIndex = 0; rowIndex < tierRowCount; rowIndex += 1) {
      const row = tierNodes.slice(rowIndex * columns, (rowIndex + 1) * columns);
      let x = 4;
      for (const item of row) {
        const ordinal = (documentIndex.get(item.claim.id) ?? 0) + 1;
        const exhibitLabel = `${type.replaceAll("_", " ").toUpperCase()} ${String(ordinal).padStart(2, "0")}`;
        const displayedId = truncateId(item.claim.id);
        const nodeWidth = Math.max(116, Math.ceil(exhibitLabel.length * 5.8 + 14), Math.ceil(displayedId.length * 5 + 14));
        nodes.push({
          ...item,
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
          tierIndex: visibleTierIndex,
          rowIndex,
          tierRowCount,
          exhibitLabel,
          displayedId,
        });
        x += nodeWidth + horizontalGap;
      }
      width = Math.max(width, x - horizontalGap + 4);
      y += nodeHeight + rowGap;
    }
    y += tierGap - rowGap;
    visibleTierIndex += 1;
  }

  return { nodes, width, height: Math.max(46, y - tierGap + 4) };
}

function routeEdge(source: PlacedNode, target: PlacedNode, mapWidth: number) {
  const [upper, lower] = source.y <= target.y ? [source, target] : [target, source];
  const clean = Math.abs(source.tierIndex - target.tierIndex) === 1
    && upper.rowIndex === upper.tierRowCount - 1
    && lower.rowIndex === 0;
  if (clean) {
    const upperX = upper.x + upper.width / 2;
    const lowerX = lower.x + lower.width / 2;
    const upperY = upper.y + upper.height;
    const lowerY = lower.y;
    const gutterY = upperY + (lowerY - upperY) / 2;
    return { clean, path: `M ${upperX} ${upperY} L ${upperX} ${gutterY} L ${lowerX} ${gutterY} L ${lowerX} ${lowerY}` };
  }
  const outerX = mapWidth - 3;
  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x + target.width;
  const targetY = target.y + target.height / 2;
  return { clean, path: `M ${sourceX} ${sourceY} L ${outerX} ${sourceY} L ${outerX} ${targetY} L ${targetX} ${targetY}` };
}

function truncateId(id: string) {
  return id.length <= 24 ? id : `${id.slice(0, 23)}…`;
}
