import type { ClaimGraph } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import { understandingMapState } from "@/lib/understanding-map";
import { getDomainProfile, type ProfileId } from "@/lib/domain-profile";

export function UnderstandingMap({ graph, decisionLog, compact = false, profileId = "essay" }: { graph: ClaimGraph; decisionLog: DecisionLogEntry[]; compact?: boolean; profileId?: ProfileId }) {
  const profile = getDomainProfile(profileId);
  const state = understandingMapState(graph, decisionLog, profileId);
  const positions = new Map(state.map(({ claim, index }) => [claim.id, { x: (index % 2) * 126 + 4, y: Math.floor(index / 2) * 42 + 4 }]));
  const height = Math.max(46, Math.ceil(state.length / 2) * 42 + 4);
  const claimIds = new Set(state.map(({ claim }) => claim.id));

  return <figure className={`understanding-map ${compact ? "compact" : ""}`}>
    <figcaption>{profile.dossier_vocab.understanding_map}</figcaption>
    <svg viewBox={`0 0 256 ${height}`} role="img" aria-label="Graph coverage from examiner decisions">
      <g className="understanding-edges">
        {graph.edges.filter((edge) => claimIds.has(edge.source) && claimIds.has(edge.target)).map((edge) => {
          const source = positions.get(edge.source)!;
          const target = positions.get(edge.target)!;
          return <line key={`${edge.source}-${edge.target}-${edge.type}`} x1={source.x + 59} y1={source.y + 15} x2={target.x + 59} y2={target.y + 15} />;
        })}
      </g>
      {state.map(({ claim, index, status }) => {
        const position = positions.get(claim.id)!;
        return <g className={`understanding-node ${status}`} key={claim.id} transform={`translate(${position.x} ${position.y})`}>
          <rect width="118" height="30" rx="1" />
          <text x="6" y="11">{profileId === "code" ? "DECISION" : "CLAIM"} {String(index + 1).padStart(2, "0")}</text>
          <text className="understanding-node-id" x="6" y="23">{claim.id.slice(0, 17)}</text>
        </g>;
      })}
    </svg>
    <div className="understanding-legend"><span><i className="examined" />examined</span><span><i className="being_examined" />being examined</span><span><i className="not_yet_examined" />not yet examined</span></div>
  </figure>;
}
