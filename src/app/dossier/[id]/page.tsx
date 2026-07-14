import { notFound } from "next/navigation";
import { loadDossier, type Dossier } from "@/lib/dossier-store";
import { formatElapsed } from "@/lib/scripted-viva";

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let dossier: Dossier;
  try {
    dossier = await loadDossier(id);
  } catch {
    notFound();
  }

  const claimNodes = new Map(dossier.graph.nodes.filter((node) => node.type === "claim").map((node) => [node.id, node]));
  const transcriptSequence = new Map(
    dossier.transcript.map((turn) => [`${turn.target_claim_id}:${turn.elapsed_ms}`, turn.sequence]),
  );

  return <main className="dossier-page">
    <header className="dossier-header">
      <p>ELEZA — VIVA DOSSIER</p>
      <div className="dossier-rule" />
      <h1>{dossier.title}</h1>
      <div className="dossier-meta">Anonymous student · {formatDate(dossier.createdAt)} · Viva duration {formatElapsed(dossier.durationMs)}</div>
      <div className="dossier-rule" />
      <em>This dossier presents evidence. Conclusions belong to the teacher.</em>
    </header>

    <DossierSection title="CLAIMS DEFENDED">
      {dossier.analysis.claims_defended.length === 0 && <p className="dossier-empty">No claim met the defended-claim receipt rule.</p>}
      {dossier.analysis.claims_defended.map((defended, index) => {
        const claim = claimNodes.get(defended.claim_id);
        return <article className="defended-claim" key={defended.claim_id}>
          <div className="dossier-exhibit">CLAIM {String(index + 1).padStart(2, "0")} · {defended.claim_id}</div>
          <h2>{claim?.label ?? defended.claim_id}</h2>
          <div className="defended-receipt">
            <div>{formatElapsed(defended.timestamp)} — strongest defense</div>
            <blockquote>“{defended.transcript_excerpt}”</blockquote>
            <p>{defended.note}</p>
          </div>
        </article>;
      })}
    </DossierSection>

    <DossierSection title="FINDINGS">
      {dossier.analysis.findings.length === 0 && <p className="dossier-empty">No content-divergence receipts were found.</p>}
      {dossier.analysis.findings.map((finding, index) => {
        const claim = claimNodes.get(finding.claim_id);
        const sequence = transcriptSequence.get(`${finding.claim_id}:${finding.timestamp}`);
        const letter = String.fromCharCode(65 + index);
        return <article className="dossier-finding" key={`${finding.claim_id}-${finding.type}-${finding.timestamp}`}>
          <div className="finding-label">FINDING {letter} — {finding.type.replaceAll("_", " ")}</div>
          <div className="finding-receipt-grid">
            <div id={`finding-${index}-transcript`}>
              <div className="receipt-label">FROM THE VIVA · {finding.claim_id}</div>
              <a className="finding-time" href={`#finding-${index}-document`}>{formatElapsed(finding.timestamp)}</a>
              <blockquote>{sequence === undefined
                ? <>“{finding.transcript_excerpt}”</>
                : <a className="transcript-receipt-link" href={`#transcript-${sequence}`}>“{finding.transcript_excerpt}”</a>}
              </blockquote>
            </div>
            <div className="finding-divider" />
            <div id={`finding-${index}-document`}>
              <div className="receipt-label">FROM THE ESSAY · CHARACTERS {finding.doc_span.start}–{finding.doc_span.end}</div>
              <a className="document-receipt" href={`#finding-${index}-transcript`}>
                <DocumentReceipt text={dossier.sourceText} start={finding.doc_span.start} end={finding.doc_span.end} />
              </a>
              {claim && <small>{claim.label}</small>}
            </div>
          </div>
          <p className="finding-note">{finding.note}</p>
        </article>;
      })}
    </DossierSection>

    <DossierSection title="APPENDIX">
      <details className="dossier-details">
        <summary>Full transcript — {dossier.transcript.length} turns, {formatElapsed(dossier.durationMs)}</summary>
        <div className="dossier-record">
          {dossier.transcript.map((turn) => <div id={`transcript-${turn.sequence}`} className="record-row" key={turn.id}>
            <time>{formatElapsed(turn.elapsed_ms)}</time>
            <span className={turn.speaker === "examiner" ? "examiner-record" : ""}>{turn.speaker.toUpperCase()} — {turn.text}</span>
          </div>)}
        </div>
      </details>
      <details className="dossier-details">
        <summary>Examiner decision log — {dossier.decisionLog.length} entries</summary>
        <div className="dossier-record decision-record">
          {dossier.decisionLog.map((entry) => <div className="record-row" key={entry.id}>
            <time>{formatElapsed(entry.answered_at_ms)}</time>
            <span><b>{entry.target_claim_id} · {entry.assessment} · {entry.action} → {entry.next_claim_id}</b><br />{entry.rationale}</span>
          </div>)}
        </div>
      </details>
    </DossierSection>

    <footer className="dossier-footer"><div className="dossier-rule" />END OF DOSSIER · ELEZA · EVIDENCE ONLY</footer>
  </main>;
}

function DossierSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="dossier-section"><div className="dossier-section-title">{title}</div>{children}</section>;
}

function DocumentReceipt({ text, start, end }: { text: string; start: number; end: number }) {
  const contextStart = Math.max(0, text.lastIndexOf("\n", Math.max(0, start - 180)) + 1);
  const nextBreak = text.indexOf("\n", Math.min(text.length, end + 180));
  const contextEnd = nextBreak === -1 ? Math.min(text.length, end + 180) : nextBreak;
  return <span>{contextStart > 0 ? "…" : ""}{text.slice(contextStart, start)}<mark>{text.slice(start, end)}</mark>{text.slice(end, contextEnd)}{contextEnd < text.length ? "…" : ""}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}
