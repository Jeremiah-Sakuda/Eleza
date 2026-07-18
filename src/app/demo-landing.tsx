"use client";

import { useEffect, useState } from "react";
import type { ClaimGraph } from "@/lib/claim-graph";
import { countWords, PASTE_MAX_WORDS, PASTE_MIN_WORDS } from "@/lib/paste-submission";

type DemoFixture = { title: string; sourceText: string; graph: ClaimGraph };

export default function DemoLanding({ judge, practice }: { judge: DemoFixture; practice: DemoFixture }) {
  const [pastedText, setPastedText] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [mappingPaste, setMappingPaste] = useState(false);
  const [judgeAccessCode, setJudgeAccessCode] = useState("");
  const pastedWordCount = countWords(pastedText);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setJudgeAccessCode(query.get("judge_code") ?? query.get("judge") ?? "");
  }, []);

  function start(fixture: DemoFixture, options: { practice: boolean; deliveryMode: "voice" | "text" }) {
    sessionStorage.setItem("eleza:viva-handoff", JSON.stringify({
      ...fixture,
      practice: options.practice,
      deliveryMode: options.deliveryMode,
      durationMs: 120_000,
      profileId: "essay",
      judgeAccessCode: judgeAccessCode || undefined,
    }));
    window.location.assign("/viva");
  }

  async function inspectPastedWriting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pastedWordCount < PASTE_MIN_WORDS || pastedWordCount > PASTE_MAX_WORDS) return;
    setPasteError("");
    setMappingPaste(true);
    try {
      const response = await fetch("/api/claim-graph/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText }),
      });
      const result = await response.json() as { sourceText?: string; graph?: ClaimGraph; persistence?: { persisted: boolean; submissionId?: string; graphId?: string; profileId: "essay" }; error?: string };
      if (!response.ok || !result.sourceText || !result.graph || !result.persistence) {
        throw new Error(result.error || "This text could not be mapped into an argument.");
      }
      sessionStorage.setItem("eleza:inspection-handoff", JSON.stringify({
        title: "Pasted argumentative writing",
        sourceKind: "paste",
        durationMs: 120_000,
        profileId: "essay",
        judgeAccessCode: judgeAccessCode || undefined,
        result,
      }));
      window.location.assign("/inspect");
    } catch (cause) {
      setPasteError(cause instanceof Error ? cause.message : "This text could not be mapped into an argument.");
      setMappingPaste(false);
    }
  }

  return <div className="judge-landing">
    <nav className="judge-nav"><a href="/" className="wordmark">ELEZA</a><div><a href="/triage">Teacher triage</a><span>NO LOGIN · ABOUT TWO MINUTES</span></div></nav>
    <header className="judge-hero">
      <p className="eyebrow">RECEIPTS, NOT VERDICTS</p>
      <h1>An essay can&apos;t tell you what a student understands.<br />A conversation can.</h1>
      <p>Eleza holds a short oral defense against a submission’s exact claims, shows why it routes every question, and returns evidence instead of a score.</p>
    </header>

    <main className="judge-main">
      <section className="judge-essay" aria-labelledby="sample-title">
        <div className="judge-section-rule"><span>SYNTHETIC SAMPLE ESSAY</span><span>537 WORDS · 8 CLAIMS</span></div>
        <h2 id="sample-title">{judge.title}</h2>
        <div className="judge-essay-copy">{judge.sourceText}</div>
      </section>
      <aside className="judge-action-card">
        <p className="eyebrow">TRY THE COMPLETE LOOP</p>
        <h2>Defend this essay yourself.</h2>
        <p>About two minutes. The examiner asks about the text on this page. Your dossier appears when time is up.</p>
        <button onClick={() => start(judge, { practice: false, deliveryMode: "voice" })}>Defend this essay — about two minutes</button>
        <button className="judge-text-button" onClick={() => start(judge, { practice: false, deliveryMode: "text" })}>Use typed answers instead</button>
        <div className="judge-card-rule" />
        <button className="judge-practice-button" onClick={() => start(practice, { practice: true, deliveryMode: "voice" })}>Try an unrecorded warm-up</button>
        <small>Practice uses a different sample and saves no transcript, decisions, or dossier.</small>
        <label className="judge-access-field">JUDGE ACCESS CODE<input type="password" autoComplete="off" value={judgeAccessCode} onChange={(event) => setJudgeAccessCode(event.target.value)} placeholder="Optional" /></label>
      </aside>
    </main>

    <section className="judge-paste" aria-labelledby="paste-title">
      <div>
        <p className="eyebrow">YOUR WRITING</p>
        <h2 id="paste-title">Defend your own writing.</h2>
        <p>Works best on argumentative writing that states a position and supports it with distinct claims.</p>
      </div>
      <form onSubmit={inspectPastedWriting}>
        <label htmlFor="pasted-writing">Paste 250–1,200 words</label>
        <textarea id="pasted-writing" rows={10} value={pastedText} onChange={(event) => setPastedText(event.target.value)} placeholder="Paste your argumentative prose here…" />
        <div><span className={pastedWordCount > PASTE_MAX_WORDS ? "over" : ""}>{pastedWordCount.toLocaleString("en-US")} words</span><button type="submit" disabled={mappingPaste || pastedWordCount < PASTE_MIN_WORDS || pastedWordCount > PASTE_MAX_WORDS}>{mappingPaste ? "Mapping your argument…" : "Map my argument"}</button></div>
        {pastedWordCount > 0 && pastedWordCount < PASTE_MIN_WORDS && <p className="paste-guidance">Paste at least 250 words so there is enough argument to examine.</p>}
        {pastedWordCount > PASTE_MAX_WORDS && <p className="paste-guidance">Keep the pasted text to 1,200 words or fewer.</p>}
        {pasteError && <p className="paste-guidance" role="alert">{pasteError}</p>}
      </form>
    </section>

    <section className="judge-steps" aria-label="How the demo works">
      <div><b>01</b><h3>Read the essay</h3><p>The sample is already parsed into exact claim spans.</p></div>
      <div><b>02</b><h3>Talk it through</h3><p>Answer by voice or text while the examiner’s receipts appear live.</p></div>
      <div><b>03</b><h3>Get your dossier</h3><p>See what you defended and any content gaps. No score.</p></div>
    </section>
    <footer className="judge-footer"><span>NO DETECTION. NO SCORES. EVIDENCE ONLY.</span><span>Eleza · oral defense for student writing</span></footer>
  </div>;
}
