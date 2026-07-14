"use client";

import { useEffect, useRef, useState } from "react";
import type { ClaimGraph, ClaimGraphNode } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import { formatElapsed, type TranscriptTurn } from "@/lib/scripted-viva";
import {
  DEAD_AIR_LIMIT_MS,
  renderVoiceQuestionInstruction,
  VivaQuestionPipeline,
  VIVA_DURATION_MS,
  type VivaQuestion,
} from "@/lib/viva-pipeline";

type SessionStatus = "loading" | "idle" | "connecting" | "live" | "ending" | "complete" | "error";
type SessionPhase = "listening" | "speaking" | "thinking";
type Handoff = { title: string; sourceText: string; graph: ClaimGraph; submissionId?: string };
type LiveTurn = TranscriptTurn & { targetClaimId?: string; questionKind?: VivaQuestion["kind"] };

export default function VivaPage() {
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [phase, setPhase] = useState<SessionPhase>("listening");
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [draft, setDraft] = useState<{ speaker: TranscriptTurn["speaker"]; text: string } | null>(null);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [pendingDecisions, setPendingDecisions] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [maxDeadAirMs, setMaxDeadAirMs] = useState(0);
  const [stallCount, setStallCount] = useState(0);
  const [error, setError] = useState("");

  const startedAt = useRef(0);
  const turnsRef = useRef<LiveTurn[]>([]);
  const pipeline = useRef<VivaQuestionPipeline | null>(null);
  const voiceQuestionTemplate = useRef<string | null>(null);
  const activeQuestion = useRef<VivaQuestion | null>(null);
  const answerSequence = useRef(0);
  const vivaSessionId = useRef<string | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const awaitingAudioSince = useRef<number | null>(null);
  const pending = useRef(new Set<Promise<void>>());
  const completedTranscriptions = useRef(new Set<string>());
  const lastCompletedTranscript = useRef<{ text: string; at: number } | null>(null);
  const evaluationFailure = useRef<Error | null>(null);
  const ending = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("eleza:viva-handoff");
    if (!raw) { setStatus("idle"); return; }
    try {
      const parsed = JSON.parse(raw) as Handoff;
      pipeline.current = new VivaQuestionPipeline(parsed.graph);
      setHandoff(parsed);
      setStatus("idle");
    } catch {
      setError("The claim graph handoff could not be read. Return to the submission and parse it again.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (status !== "live") return;
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAt.current;
      setElapsedMs(Math.min(next, VIVA_DURATION_MS));
      if (next >= VIVA_DURATION_MS) void endViva();
    }, 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => stopTransport(), []);

  function appendTurn(
    speaker: TranscriptTurn["speaker"],
    text: string,
    question?: VivaQuestion,
    at = Date.now() - startedAt.current,
  ) {
    const clean = text.trim();
    if (!clean) return;
    const turn: LiveTurn = {
      id: `${speaker}-${turnsRef.current.length}-${at}`,
      speaker,
      text: clean,
      elapsedMs: Math.max(0, at),
      targetClaimId: question?.targetClaimId,
      questionKind: question?.kind,
    };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  }

  function stopTransport() {
    channel.current?.close();
    peer.current?.close();
    microphone.current?.getTracks().forEach((track) => track.stop());
    remoteAudio.current?.remove();
    channel.current = null;
    peer.current = null;
    microphone.current = null;
    remoteAudio.current = null;
  }

  function fail(cause: unknown) {
    if (ending.current) return;
    setError(cause instanceof Error ? cause.message : "The live viva failed.");
    setStatus("error");
    stopTransport();
  }

  function recordAudioStart() {
    if (awaitingAudioSince.current === null) return;
    const delay = Math.round(performance.now() - awaitingAudioSince.current);
    awaitingAudioSince.current = null;
    setMaxDeadAirMs((current) => Math.max(current, delay));
    if (delay > DEAD_AIR_LIMIT_MS) setStallCount((current) => current + 1);
  }

  function speakQuestion(question: VivaQuestion, answerCompletedAt?: number) {
    if (channel.current?.readyState !== "open") throw new Error("Realtime control channel is not open.");
    if (!voiceQuestionTemplate.current) throw new Error("Realtime question delivery template is not loaded.");
    activeQuestion.current = question;
    if (answerCompletedAt !== undefined) awaitingAudioSince.current = answerCompletedAt;
    setPhase("speaking");
    // DECISION: an empty input plus one externally routed question prevents the voice model from freelancing.
    channel.current.send(JSON.stringify({
      type: "response.create",
      response: {
        conversation: "none",
        metadata: {
          question_id: question.id,
          target_claim_id: question.targetClaimId,
          question_kind: question.kind,
        },
        input: [],
        output_modalities: ["audio"],
        instructions: renderVoiceQuestionInstruction(voiceQuestionTemplate.current, question),
      },
    }));
  }

  function targetClaimFor(question: VivaQuestion): ClaimGraphNode {
    const target = handoff?.graph.nodes.find((node) => node.id === question.targetClaimId && node.type === "claim");
    if (!target) throw new Error(`Question ${question.id} lost its claim trace.`);
    return target;
  }

  async function evaluateCompletedAnswer(question: VivaQuestion, transcript: string, sequence: number, answeredAtMs: number) {
    if (!handoff || !vivaSessionId.current) throw new Error("The viva session is not ready for examiner decisions.");
    try {
      setPendingDecisions((count) => count + 1);
      const response = await fetch("/api/viva/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: vivaSessionId.current,
          sequence,
          answered_at_ms: answeredAtMs,
          transcript_segment: transcript,
          target_claim: targetClaimFor(question),
          graph: handoff.graph,
        }),
      });
      const result = await response.json() as { entry?: DecisionLogEntry; error?: string };
      if (!response.ok || !result.entry) throw new Error(result.error || "The examiner did not return a persisted decision.");
      pipeline.current?.acceptDecision(result.entry, sequence);
      setDecisionLog((current) => [...current, result.entry as DecisionLogEntry].sort((a, b) => a.sequence - b.sequence));
    } catch (cause) {
      evaluationFailure.current = cause instanceof Error ? cause : new Error("An examiner decision failed.");
      fail(cause);
    } finally {
      setPendingDecisions((count) => Math.max(0, count - 1));
    }
  }

  function handleCompletedAnswer(transcript: string) {
    const question = activeQuestion.current;
    const clean = transcript.trim();
    if (!question || !clean || !pipeline.current) return;
    const answeredAtMs = Math.max(0, Date.now() - startedAt.current);
    const sequence = answerSequence.current;
    answerSequence.current += 1;
    appendTurn("student", clean, question, answeredAtMs);
    setDraft(null);
    setPhase("thinking");

    // Start evaluation first, then dispatch an already-prefetched question without awaiting the model.
    const task = evaluateCompletedAnswer(question, clean, sequence, answeredAtMs);
    pending.current.add(task);
    void task.finally(() => pending.current.delete(task));
    const answerCompletedAt = performance.now();
    const immediateQuestion = pipeline.current.nextImmediate();
    speakQuestion(immediateQuestion, answerCompletedAt);
  }

  function handleRealtimeEvent(event: MessageEvent<string>) {
    try {
      const message = JSON.parse(event.data) as Record<string, unknown>;
      const type = String(message.type ?? "");
      if (type === "response.output_audio.delta") {
        recordAudioStart();
      } else if (type === "response.output_audio_transcript.delta") {
        const delta = String(message.delta ?? "");
        setDraft((current) => ({ speaker: "examiner", text: current?.speaker === "examiner" ? current.text + delta : delta }));
      } else if (type === "response.output_audio_transcript.done") {
        const question = activeQuestion.current;
        appendTurn("examiner", String(message.transcript ?? question?.text ?? ""), question ?? undefined);
        setDraft(null);
        setPhase("listening");
      } else if (type === "conversation.item.input_audio_transcription.delta") {
        const delta = String(message.delta ?? "");
        setDraft((current) => ({ speaker: "student", text: current?.speaker === "student" ? current.text + delta : delta }));
      } else if (type === "conversation.item.input_audio_transcription.completed" || type === "conversation.item.input_audio_transcription.done") {
        const transcript = String(message.transcript ?? "").trim();
        const itemId = String(message.item_id ?? "");
        const now = Date.now();
        const repeatedWithoutId = !itemId && lastCompletedTranscript.current?.text === transcript
          && now - lastCompletedTranscript.current.at < 1_000;
        if ((itemId && completedTranscriptions.current.has(itemId)) || repeatedWithoutId) return;
        if (itemId) completedTranscriptions.current.add(itemId);
        lastCompletedTranscript.current = { text: transcript, at: now };
        handleCompletedAnswer(transcript);
      } else if (type === "input_audio_buffer.speech_started") {
        setPhase("listening");
      } else if (type === "error") {
        fail(new Error(JSON.stringify(message.error ?? message)));
      }
    } catch (cause) {
      fail(cause);
    }
  }

  async function startLiveSession() {
    if (!handoff || !pipeline.current) return;
    stopTransport();
    turnsRef.current = [];
    setTurns([]);
    setDecisionLog([]);
    setPendingDecisions(0);
    setElapsedMs(0);
    setMaxDeadAirMs(0);
    setStallCount(0);
    setError("");
    setStatus("connecting");
    answerSequence.current = 0;
    completedTranscriptions.current.clear();
    lastCompletedTranscript.current = null;
    evaluationFailure.current = null;
    ending.current = false;
    pipeline.current = new VivaQuestionPipeline(handoff.graph);

    try {
      if (!voiceQuestionTemplate.current) {
        const templateResponse = await fetch("/api/realtime/question-template");
        const templateResult = await templateResponse.json() as { template?: string; error?: string };
        if (!templateResponse.ok || !templateResult.template) {
          throw new Error(templateResult.error || "Could not load the Realtime question template.");
        }
        voiceQuestionTemplate.current = templateResult.template;
      }
      const sessionResponse = await fetch("/api/viva/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph: handoff.graph,
          submissionId: handoff.submissionId,
          sourceText: handoff.sourceText,
          title: handoff.title,
        }),
      });
      const session = await sessionResponse.json() as { id?: string; error?: string };
      if (!sessionResponse.ok || !session.id) throw new Error(session.error || "Could not create the decision log.");
      vivaSessionId.current = session.id;

      const pc = new RTCPeerConnection();
      const audio = document.createElement("audio");
      audio.autoplay = true;
      pc.ontrack = (received) => { audio.srcObject = received.streams[0]; };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const dataChannel = pc.createDataChannel("oai-events");
      dataChannel.addEventListener("message", handleRealtimeEvent);
      dataChannel.addEventListener("open", () => {
        startedAt.current = Date.now();
        setStatus("live");
        try { speakQuestion(pipeline.current!.opening()); } catch (cause) { fail(cause); }
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed") fail(new Error("The WebRTC voice connection failed."));
      });
      peer.current = pc;
      channel.current = dataChannel;
      microphone.current = stream;
      remoteAudio.current = audio;

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const realtimeResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!realtimeResponse.ok) throw new Error((await realtimeResponse.text()) || "Could not create the Realtime voice session.");
      await pc.setRemoteDescription({ type: "answer", sdp: await realtimeResponse.text() });
    } catch (cause) {
      fail(cause);
    }
  }

  async function endViva() {
    if (ending.current || status === "complete" || status === "idle") return;
    ending.current = true;
    setStatus("ending");
    setElapsedMs((current) => Math.min(Math.max(current, Date.now() - startedAt.current), VIVA_DURATION_MS));
    stopTransport();
    await Promise.allSettled([...pending.current]);
    try {
      if (evaluationFailure.current) throw evaluationFailure.current;
      if (vivaSessionId.current) {
        const response = await fetch(`/api/viva/sessions/${vivaSessionId.current}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: turnsRef.current }),
        });
        const result = await response.json() as { dossierId?: string; error?: string };
        if (!response.ok || !result.dossierId) throw new Error(result.error || "Could not generate the viva dossier.");
        setStatus("complete");
        window.location.assign(`/dossier/${result.dossierId}`);
        return;
      }
      setStatus("complete");
    } catch (cause) {
      ending.current = false;
      fail(cause);
    }
  }

  if (status === "loading") return <div className="viva-empty">Loading claim graph…</div>;
  if (!handoff) return <div className="viva-empty"><span className="wordmark">ELEZA</span><h1>No claim graph is loaded.</h1><p>Parse the fixture essay first, then proceed from its inspection view.</p><a href="/">Return to submission</a></div>;

  const label = status === "live" ? "LIVE" : status === "connecting" ? "CONNECTING" : status === "ending" ? "ENDING" : status === "complete" ? "ENDED" : "READY";
  const health = stallCount === 0 ? `${Math.round(maxDeadAirMs)} ms max handoff` : `${stallCount} handoff${stallCount === 1 ? "" : "s"} over 2s`;

  return <div className="viva-shell">
    <nav className="viva-nav"><div><span className="wordmark">ELEZA</span><i /><span className="mast-title">{handoff.title}</span></div><div className="viva-clock"><span className={`live-dot ${status === "live" ? "active" : ""}`} />{label}<b>{formatElapsed(elapsedMs)}</b></div></nav>
    <div className="viva-disclosure">You’re speaking with an AI examiner. Everything is logged and shown.</div>

    <main className="viva-main viva-reasoning-layout">
      <section className="transcript-column">
        <p className="column-label">TRANSCRIPT</p>
        {turns.length === 0 && <div className="viva-ready-copy"><h1>Defend the argument.</h1><p>The examiner will ask questions tied to the parsed claim graph. The session ends after five minutes.</p><button onClick={startLiveSession} disabled={status === "connecting"}>Start five-minute viva</button></div>}
        {turns.map((turn) => <article className={`transcript-turn ${turn.speaker}`} key={turn.id}>
          <time>{formatElapsed(turn.elapsedMs)}</time><div><small>{turn.speaker.toUpperCase()}{turn.targetClaimId ? ` · ${turn.targetClaimId}${turn.questionKind === "bridge" ? " · BRIDGE" : ""}` : ""}</small><p>{turn.text}</p></div>
        </article>)}
        {draft && <article className={`transcript-turn ${draft.speaker} draft`}><time>LIVE</time><div><small>{draft.speaker.toUpperCase()}</small><p>{draft.text}</p></div></article>}
        {status === "complete" && <div className="viva-complete-rule">Viva complete. {decisionLog.length} examiner decisions recorded.</div>}
      </section>

      <aside className="reasoning-pane">
        <p className="column-label">EXAMINER — LIVE REASONING</p>
        {decisionLog.length === 0 && pendingDecisions === 0 && <p className="reasoning-empty">Specific routing receipts will appear after each completed answer.</p>}
        {decisionLog.map((entry) => <article className="reasoning-entry" key={entry.id}>
          <time>{formatElapsed(entry.answered_at_ms)}</time>
          <div className="reasoning-route"><span>{entry.target_claim_id}</span><b>{entry.action}</b><span>→ {entry.next_claim_id}</span></div>
          <p>{entry.rationale}</p>
        </article>)}
        {pendingDecisions > 0 && <div className="reasoning-pending"><span>deciding</span><b>···</b><small>{pendingDecisions} answer{pendingDecisions === 1 ? "" : "s"} processing</small></div>}
      </aside>
    </main>

    {error && <p className="viva-error" role="alert">{error}</p>}
    <footer className="viva-controls"><div><span className={phase === "listening" && status === "live" ? "active" : ""}>LISTENING</span><i /><span className={phase === "speaking" && status === "live" ? "active" : ""}>SPEAKING</span><i /><span className={phase === "thinking" && status === "live" ? "active" : ""}>THINKING</span></div><div className="viva-health"><span>{health}</span>{status === "live" && <button onClick={() => void endViva()}>End viva early</button>}</div></footer>
  </div>;
}
