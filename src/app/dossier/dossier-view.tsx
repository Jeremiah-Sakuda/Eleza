import { formatElapsed } from "@/lib/scripted-viva";
import type { Dossier } from "@/lib/dossier-store";
import { PrintDossierButton } from "@/app/dossier/print-dossier-button";
import { StudentDossierLink } from "@/app/dossier/student-dossier-link";
import { MetaVivaExchange } from "@/app/meta-viva-exchange";
import { UnderstandingMap } from "@/app/understanding-map";
import { getDomainProfile, profileDefendedSingular, profileDefenseLabel, profileSourceLabel } from "@/lib/domain-profile";
import { isPrimaryNode } from "@/lib/claim-graph";

export function DossierView({ dossier, studentPath }: { dossier: Dossier; studentPath?: string }) {
  const profile = getDomainProfile(dossier.profileId);
  const claimNodes = new Map(dossier.graph.nodes.filter((node) => isPrimaryNode(node, dossier.profileId)).map((node) => [node.id, node]));
  const isCode = dossier.profileId === "code";
  const transcriptSequence = new Map(
    dossier.transcript.map((turn) => [`${turn.target_claim_id}:${turn.elapsed_ms}`, turn.sequence]),
  );

  return <main className="dossier-page">
    <div className="dossier-actions"><PrintDossierButton /></div>
    {studentPath && <StudentDossierLink path={studentPath} />}
    <header className="dossier-header">
      <p>ELEZA — VIVA DOSSIER</p>
      <p className="dossier-defense-label">{profileDefenseLabel(dossier.profileId)}</p>
      <div className="dossier-rule" />
      <h1>{dossier.title}</h1>
      <div className="dossier-meta">Anonymous student · {formatDate(dossier.createdAt)} · Viva duration {formatElapsed(dossier.durationMs)}</div>
      <div className="dossier-rule" />
      <em>This dossier presents evidence. Conclusions belong to the teacher.</em>
    </header>

    <UnderstandingMap graph={dossier.graph} decisionLog={dossier.decisionLog} profileId={dossier.profileId} />

    <DossierSection title={profile.dossier_vocab.claims_defended}>
      {dossier.analysis.claims_defended.length === 0 && <p className="dossier-empty">No {profileDefendedSingular(dossier.profileId)} was defended fully in this session. The transcript below shows what was discussed.</p>}
      {dossier.analysis.claims_defended.map((defended, index) => {
        const claim = claimNodes.get(defended.claim_id);
        return <article className="defended-claim" key={defended.claim_id}>
          <div className="dossier-exhibit">{claim?.type.replaceAll("_", " ").toUpperCase() ?? "NODE"} {String(index + 1).padStart(2, "0")} · {defended.claim_id}</div>
          <h2>{claim?.label ?? defended.claim_id}</h2>
          {isCode && claim && <CodeReceipt text={dossier.sourceText} start={claim.source_span.start} end={claim.source_span.end} tone="defended" />}
          <div className="defended-receipt">
            <div>{formatElapsed(defended.timestamp)} — strongest defense</div>
            <blockquote>“{defended.transcript_excerpt}”</blockquote>
            <p>{defended.note}</p>
          </div>
        </article>;
      })}
    </DossierSection>

    <DossierSection title="FINDINGS">
      {dossier.analysis.findings.length === 0 && <p className="dossier-empty">No findings. This records what was examined, not a judgment.</p>}
      {dossier.analysis.findings.map((finding, index) => {
        const claim = claimNodes.get(finding.claim_id);
        const sequence = transcriptSequence.get(`${finding.claim_id}:${finding.timestamp}`);
        const letter = String.fromCharCode(65 + index);
        return <article className="dossier-finding" id={`finding-${index}`} key={`${finding.claim_id}-${finding.type}-${finding.timestamp}`}>
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
              <div className="receipt-label">FROM THE {profileSourceLabel(dossier.profileId)} · {isCode ? lineRangeLabel(dossier.sourceText, finding.doc_span.start, finding.doc_span.end) : `CHARACTERS ${finding.doc_span.start}–${finding.doc_span.end}`}</div>
              <a className="document-receipt" href={`#finding-${index}-transcript`}>
                {isCode
                  ? <CodeReceipt text={dossier.sourceText} start={finding.doc_span.start} end={finding.doc_span.end} tone="finding" />
                  : <DocumentReceipt text={dossier.sourceText} start={finding.doc_span.start} end={finding.doc_span.end} />}
              </a>
              {claim && <small>{claim.label}</small>}
            </div>
          </div>
          <p className="finding-note">{finding.note}</p>
          {finding.follow_up_questions.length > 0 && <div className="finding-follow-ups">
            <strong>FOR YOUR CONVERSATION</strong>
            <ul>{finding.follow_up_questions.map((question) => <li key={question}>{question}</li>)}</ul>
          </div>}
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
            <span><b>{entry.target_claim_id} · {entry.assessment} · {entry.action} → {entry.next_claim_id}</b><br />{entry.rationale}{claimNodes.get(entry.target_claim_id) && <MetaVivaExchange decision={entry} targetClaim={claimNodes.get(entry.target_claim_id)!} profileId={dossier.profileId} />}</span>
          </div>)}
        </div>
      </details>
    </DossierSection>

    <footer className="dossier-footer"><div className="dossier-rule" />END OF DOSSIER · ELEZA · EVIDENCE ONLY</footer>
    <div className="dossier-print-footer" aria-hidden="true">
      <span>Generated {formatPrintTimestamp(dossier.createdAt)}</span>
      <span className="dossier-print-page">Page </span>
    </div>
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

function CodeReceipt({ text, start, end, tone }: { text: string; start: number; end: number; tone: "defended" | "finding" }) {
  const lines = text.split("\n");
  const firstLine = text.slice(0, start).split("\n").length;
  const lastLine = text.slice(0, end).split("\n").length;
  const from = Math.max(1, firstLine - 1);
  const to = Math.min(lines.length, lastLine + 1);
  return <span className={`dossier-code-receipt ${tone}`}>
    {lines.slice(from - 1, to).map((line, index) => <span className="dossier-code-line" key={from + index}>
      <span>{from + index}</span><code>{line || " "}</code>
    </span>)}
  </span>;
}

function lineRangeLabel(text: string, start: number, end: number) {
  const first = text.slice(0, start).split("\n").length;
  const last = text.slice(0, end).split("\n").length;
  return first === last ? `LINE ${first}` : `LINES ${first}–${last}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function formatPrintTimestamp(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}
