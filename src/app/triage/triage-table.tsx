"use client";

import { useState } from "react";
import { formatElapsed } from "@/lib/scripted-viva";
import type { TriageRow } from "@/lib/dossier-store";
import { profileDefenseLabel } from "@/lib/domain-profile";

export default function TriageTable({ initialRows }: { initialRows: TriageRow[] }) {
  const [descending, setDescending] = useState(true);
  const rows = [...initialRows].sort((a, b) => (descending ? -1 : 1) * (a.findingCount - b.findingCount) || b.completedAt.localeCompare(a.completedAt));
  return <>
    <div className="triage-table" role="table" aria-label="Completed viva dossiers">
      <div className="triage-table-head" role="row">
        <span>STUDENT</span><span>SUBMISSION</span><span>DURATION</span><button onClick={() => setDescending((value) => !value)}>FINDINGS {descending ? "↓" : "↑"}</button><span />
      </div>
      {rows.map((row) => <div className="triage-row" role="row" key={row.dossierId}>
        <span className="triage-student">{row.studentLabel}</span>
        <span className="triage-title-cell"><span className="triage-title">{row.title}</span><small className="triage-profile">{profileDefenseLabel(row.profileId).replace(" DEFENSE", "")}</small></span>
        <span className="triage-duration">{formatElapsed(row.durationMs)}</span>
        <div className="triage-finding-cell">{row.findingCount > 0
          ? <><a className="triage-findings has-findings" href={`/dossier/${row.dossierId}#finding-0`}>{row.findingCount} finding{row.findingCount === 1 ? "" : "s"}</a><span className="triage-finding-types">{row.findingTypeSummary}</span></>
          : <span className="triage-findings">—</span>}
        </div>
        <a href={`/dossier/${row.dossierId}`}>Read dossier</a>
      </div>)}
    </div>
    <div className="triage-count">{rows.length} VIVAS · {rows.filter((row) => row.findingCount > 0).length} WITH FINDINGS</div>
  </>;
}
