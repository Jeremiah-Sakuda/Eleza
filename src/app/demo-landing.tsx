"use client";

import type { ClaimGraph } from "@/lib/claim-graph";

type DemoFixture = { title: string; sourceText: string; graph: ClaimGraph };

export default function DemoLanding({ judge, practice }: { judge: DemoFixture; practice: DemoFixture }) {
  function start(fixture: DemoFixture, options: { practice: boolean; deliveryMode: "voice" | "text" }) {
    sessionStorage.setItem("eleza:viva-handoff", JSON.stringify({
      ...fixture,
      practice: options.practice,
      deliveryMode: options.deliveryMode,
      durationMs: 120_000,
    }));
    window.location.assign("/viva");
  }

  return <div className="judge-landing">
    <nav className="judge-nav"><a href="/" className="wordmark">ELEZA</a><div><a href="/triage">Teacher triage</a><span>NO LOGIN · ABOUT TWO MINUTES</span></div></nav>
    <header className="judge-hero">
      <p className="eyebrow">RECEIPTS, NOT VERDICTS</p>
      <h1>Students can fake the essay.<br />Not the conversation.</h1>
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
      </aside>
    </main>

    <section className="judge-steps" aria-label="How the demo works">
      <div><b>01</b><h3>Read the essay</h3><p>The sample is already parsed into exact claim spans.</p></div>
      <div><b>02</b><h3>Talk it through</h3><p>Answer by voice or text while the examiner’s receipts appear live.</p></div>
      <div><b>03</b><h3>Get your dossier</h3><p>See what you defended and any content gaps. No score.</p></div>
    </section>
    <footer className="judge-footer"><span>NO DETECTION. NO SCORES. EVIDENCE ONLY.</span><span>Eleza · oral defense for student writing</span></footer>
  </div>;
}
