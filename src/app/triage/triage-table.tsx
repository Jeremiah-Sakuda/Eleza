"use client";

import { useState } from "react";
import { formatElapsed } from "@/lib/scripted-viva";
import type { TriageRow } from "@/lib/dossier-store";

export default function TriageTable({ initialRows }: { initialRows: TriageRow[] }) {
  const [descending, setDescending] = useState(true);
  const rows = [...initialRows].sort((a, b) => (descending ? -1 : 1) * (a.findingCount - b.findingCount) || b.completedAt.localeCompare(a.completedAt));
  return <>
    <div className="triage-table" role="table" aria-label="Completed viva dossiers">
      <div className="triage-table-head" role="row">
        <span>STUDENT</span><span>ESSAY</span><span>DURATION</span><button onClick={() => setDescending((value) => !value)}>FINDINGS {descending ? "↓" : "↑"}</button><span />
      </div>
      {rows.map((row) => <div className="triage-row" role="row" key={row.dossierId}>
        <span className="triage-student">{row.studentLabel}</span>
        <span className="triage-title">{row.title}</span>
        <span className="triage-duration">{formatElapsed(row.durationMs)}</span>
        <span className={row.findingCount > 0 ? "triage-findings has-findings" : "triage-findings"}>{row.findingCount > 0 ? `${row.findingCount} finding${row.findingCount === 1 ? "" : "s"}` : "—"}</span>
        <a href={`/dossier/${row.dossierId}`}>Read dossier</a>
      </div>)}
    </div>
    <div className="triage-count">{rows.length} VIVAS · {rows.filter((row) => row.findingCount > 0).length} WITH FINDINGS</div>
  </>;
}
