"use client";

import { useEffect, useRef, useState } from "react";
import type { ClaimGraph, ClaimGraphNode } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import type { ExaminerResult } from "@/lib/examiner";
import type { ProfileId } from "@/lib/domain-profile";
import { realtimeAudioInputEvent, webRtcFailureMessage } from "@/lib/realtime-control";
import { formatElapsed, type TranscriptTurn } from "@/lib/scripted-viva";
import {
  DEAD_AIR_LIMIT_MS,
  renderVoiceQuestionInstruction,
  VivaQuestionPipeline,
  VIVA_DURATION_MS,
  type VivaQuestion,
} from "@/lib/viva-pipeline";
import { MetaVivaExchange } from "@/app/meta-viva-exchange";
import { UnderstandingMap } from "@/app/understanding-map";
import { CodeSourcePanel } from "@/app/viva/code-source-panel";
import { isPrimaryNode } from "@/lib/claim-graph";

type SessionStatus = "loading" | "idle" | "connecting" | "live" | "ending" | "complete" | "error";
type SessionPhase = "listening" | "speaking" | "thinking";
type Handoff = {
  title: string;
  sourceText: string;
  graph: ClaimGraph;
  submissionId?: string;
  durationMs?: number;
  deliveryMode?: "voice" | "text";
  practice?: boolean;
  sourceKind?: "paste";
  judgeAccessCode?: string;
  profileId?: ProfileId;
};
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
  const [typedAnswer, setTypedAnswer] = useState("");
  const [activeTargetId, setActiveTargetId] = useState<string>();

  const startedAt = useRef(0);
  const turnsRef = useRef<LiveTurn[]>([]);
  const pipeline = useRef<VivaQuestionPipeline | null>(null);
  const voiceQuestionTemplate = useRef<string | null>(null);
  const activeQuestion = useRef<VivaQuestion | null>(null);
  const answerSequence = useRef(0);
  const vivaSessionId = useRef<string | null>(null);
  const practiceSessionId = useRef("00000000-0000-4000-8000-000000000000");
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
  const connectionTimer = useRef<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("eleza:viva-handoff");
    if (!raw) { setStatus("idle"); return; }
    try {
      const parsed = JSON.parse(raw) as Handoff;
      pipeline.current = new VivaQuestionPipeline(parsed.graph, parsed.profileId ?? "essay");
      setHandoff(parsed);
      setStatus("idle");
    } catch {
      setError("The claim graph handoff could not be read. Return to the submission and parse it again.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (status !== "live") return;
    const durationMs = handoff?.durationMs ?? VIVA_DURATION_MS;
    const timer = window.setInterval(() => {
      const next = Date.now() - startedAt.current;
      setElapsedMs(Math.min(next, durationMs));
      if (next >= durationMs) void endViva();
    }, 250);
    return () => window.clearInterval(timer);
  }, [status, handoff]);

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
    if (connectionTimer.current !== null) window.clearTimeout(connectionTimer.current);
    connectionTimer.current = null;
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

  function setMicrophoneEnabled(enabled: boolean) {
    microphone.current?.getAudioTracks().forEach((track) => { track.enabled = enabled; });
  }

  function sendRealtimeInputEvent(type: "input_audio_buffer.clear" | "input_audio_buffer.commit") {
    if (channel.current?.readyState !== "open") throw new Error("Realtime control channel is not open.");
    channel.current.send(JSON.stringify(realtimeAudioInputEvent(type)));
  }

  function prepareVoiceAnswer() {
    try {
      sendRealtimeInputEvent("input_audio_buffer.clear");
      setMicrophoneEnabled(true);
      setError("");
      setPhase("listening");
    } catch (cause) {
      fail(cause);
    }
  }

  function finishVoiceAnswer() {
    if (status !== "live" || phase !== "listening") return;
    try {
      setMicrophoneEnabled(false);
      setPhase("thinking");
      // DECISION: an explicit commit makes a student's button press—not a pause detector—the answer boundary.
      sendRealtimeInputEvent("input_audio_buffer.commit");
    } catch (cause) {
      fail(cause);
    }
  }

  function speakQuestion(question: VivaQuestion, answerCompletedAt?: number) {
    if (channel.current?.readyState !== "open") throw new Error("Realtime control channel is not open.");
    if (!voiceQuestionTemplate.current) throw new Error("Realtime question delivery template is not loaded.");
    activeQuestion.current = question;
    setMicrophoneEnabled(false);
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

  function deliverQuestion(question: VivaQuestion, answerCompletedAt?: number) {
    activeQuestion.current = question;
    setActiveTargetId(question.targetClaimId);
    if (handoff?.deliveryMode === "text") {
      appendTurn("examiner", question.text, question);
      setPhase("listening");
      return;
    }
    speakQuestion(question, answerCompletedAt);
  }

  function targetClaimFor(question: VivaQuestion): ClaimGraphNode {
    const target = handoff?.graph.nodes.find((node) => node.id === question.targetClaimId && isPrimaryNode(node, handoff.profileId ?? "essay"));
    if (!target) throw new Error(`Question ${question.id} lost its graph trace.`);
    return target;
  }

  async function evaluateCompletedAnswer(question: VivaQuestion, transcript: string, sequence: number, answeredAtMs: number) {
    if (!handoff || (!handoff.practice && !vivaSessionId.current)) throw new Error("The viva session is not ready for examiner decisions.");
    try {
      setPendingDecisions((count) => count + 1);
      const response = await fetch(handoff.practice ? "/api/examiner" : "/api/viva/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(handoff.practice ? {
          transcript_segment: transcript,
          target_claim: targetClaimFor(question),
          graph: handoff.graph,
          profile_id: handoff.profileId ?? "essay",
        } : {
          session_id: vivaSessionId.current,
          sequence,
          answered_at_ms: answeredAtMs,
          transcript_segment: transcript,
          target_claim: targetClaimFor(question),
          graph: handoff.graph,
          profile_id: handoff.profileId ?? "essay",
        }),
      });
      const result = await response.json() as { entry?: DecisionLogEntry; error?: string } & Partial<ExaminerResult>;
      if (!response.ok) throw new Error(result.error || "The examiner did not return a decision.");
      let entry = result.entry;
      if (handoff.practice) {
        if (!result.answer_summary || !result.target_claim_id || !result.assessment || !result.action || !result.next_claim_id || !result.next_question || !result.rationale || result.quality_gate?.status !== "passed") {
          throw new Error("The practice examiner did not return a receipt-gated decision.");
        }
        entry = {
          id: crypto.randomUUID(),
          viva_session_id: practiceSessionId.current,
          sequence,
          transcript_segment: transcript,
          answered_at_ms: answeredAtMs,
          answer_summary: result.answer_summary,
          target_claim_id: result.target_claim_id,
          assessment: result.assessment,
          action: result.action,
          next_claim_id: result.next_claim_id,
          next_question: result.next_question,
          rationale: result.rationale,
          created_at: new Date().toISOString(),
        };
      }
      if (!entry) throw new Error("The examiner did not return a persisted decision.");
      pipeline.current?.acceptDecision(entry, sequence);
      setDecisionLog((current) => [...current, entry].sort((a, b) => a.sequence - b.sequence));
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
    deliverQuestion(immediateQuestion, answerCompletedAt);
  }

  function submitTypedAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answer = typedAnswer.trim();
    if (!answer) return;
    setTypedAnswer("");
    handleCompletedAnswer(answer);
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
      } else if (type === "response.output_audio.done") {
        prepareVoiceAnswer();
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
        if (transcript) {
          handleCompletedAnswer(transcript);
        } else {
          setDraft(null);
          setError("No speech was captured. Speak your answer, then press Finish answer again.");
          setMicrophoneEnabled(true);
          setPhase("listening");
        }
      } else if (type === "error") {
        const realtimeError = message.error as Record<string, unknown> | undefined;
        const errorText = String(realtimeError?.message ?? JSON.stringify(realtimeError ?? message));
        if (/audio buffer|buffer.*small|buffer.*empty/i.test(errorText)) {
          setError("No speech was captured. Speak your answer, then press Finish answer again.");
          setMicrophoneEnabled(true);
          setPhase("listening");
          return;
        }
        fail(new Error(errorText));
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
    setTypedAnswer("");
    setStatus("connecting");
    answerSequence.current = 0;
    completedTranscriptions.current.clear();
    lastCompletedTranscript.current = null;
    evaluationFailure.current = null;
    ending.current = false;
    vivaSessionId.current = null;
    practiceSessionId.current = crypto.randomUUID();
    pipeline.current = new VivaQuestionPipeline(handoff.graph, handoff.profileId ?? "essay");

    try {
      const sessionResponse = await fetch("/api/viva/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          graph: handoff.graph,
          submissionId: handoff.submissionId,
          sourceText: handoff.sourceText,
          title: handoff.title,
          durationMs: handoff.durationMs,
          sessionKind: handoff.practice ? "practice" : "judge",
          profileId: handoff.profileId ?? "essay",
          judgeAccessCode: handoff.judgeAccessCode,
        }),
      });
      const session = await sessionResponse.json() as { id?: string; durationLimitMs?: number; error?: string };
      if (!sessionResponse.ok || !session.id) throw new Error(session.error || "Could not create the decision log.");
      vivaSessionId.current = session.id;

      if (handoff.deliveryMode === "text") {
        startedAt.current = Date.now();
        setStatus("live");
        deliverQuestion(pipeline.current.opening());
        return;
      }

      if (!voiceQuestionTemplate.current) {
        const templateResponse = await fetch("/api/realtime/question-template");
        const templateResult = await templateResponse.json() as { template?: string; error?: string };
        if (!templateResponse.ok || !templateResult.template) {
          throw new Error(templateResult.error || "Could not load the Realtime question template.");
        }
        voiceQuestionTemplate.current = templateResult.template;
      }

      const pc = new RTCPeerConnection();
      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.style.display = "none";
      document.body.appendChild(audio);
      pc.ontrack = (received) => {
        // DECISION: Safari can omit event streams, so retain the track in a fallback MediaStream and explicitly start playback.
        audio.srcObject = received.streams[0] ?? new MediaStream([received.track]);
        void audio.play().catch(() => setError("Voice connected, but the browser blocked audio playback. Tap the page, then retry."));
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getAudioTracks().forEach((track) => { track.enabled = false; });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const dataChannel = pc.createDataChannel("oai-events");
      dataChannel.addEventListener("message", handleRealtimeEvent);
      dataChannel.addEventListener("open", () => {
        if (connectionTimer.current !== null) window.clearTimeout(connectionTimer.current);
        connectionTimer.current = null;
        startedAt.current = Date.now();
        setStatus("live");
        try { deliverQuestion(pipeline.current!.opening()); } catch (cause) { fail(cause); }
      });
      dataChannel.addEventListener("error", () => {
        fail(new Error(webRtcFailureMessage(pc.connectionState, pc.iceConnectionState)));
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed") fail(new Error(webRtcFailureMessage(pc.connectionState, pc.iceConnectionState)));
      });
      pc.addEventListener("iceconnectionstatechange", () => {
        if (pc.iceConnectionState === "failed") fail(new Error(webRtcFailureMessage(pc.connectionState, pc.iceConnectionState)));
      });
      peer.current = pc;
      channel.current = dataChannel;
      microphone.current = stream;
      remoteAudio.current = audio;
      connectionTimer.current = window.setTimeout(() => {
        if (dataChannel.readyState !== "open") fail(new Error(webRtcFailureMessage(pc.connectionState, pc.iceConnectionState)));
      }, 15_000);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const tokenResponse = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: vivaSessionId.current }),
      });
      const token = await tokenResponse.json() as { value?: string; error?: string };
      if (!tokenResponse.ok || !token.value) throw new Error(token.error || "Could not authorize the Realtime voice session.");
      // DECISION: the browser exchanges SDP directly with OpenAI using a minimum-lifetime client secret; audio never crosses the app server.
      const realtimeResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" },
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
    const durationMs = handoff?.durationMs ?? VIVA_DURATION_MS;
    setElapsedMs((current) => Math.min(Math.max(current, Date.now() - startedAt.current), durationMs));
    stopTransport();
    await Promise.allSettled([...pending.current]);
    try {
      if (evaluationFailure.current) throw evaluationFailure.current;
      if (handoff?.practice) {
        if (vivaSessionId.current) {
          await fetch(`/api/viva/sessions/${vivaSessionId.current}/practice-complete`, { method: "POST" });
        }
        setStatus("complete");
        return;
      }
      if (vivaSessionId.current) {
        const response = await fetch(`/api/viva/sessions/${vivaSessionId.current}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: turnsRef.current }),
        });
        const result = await response.json() as { dossierId?: string; studentDossierPath?: string; error?: string };
        if (!response.ok || !result.dossierId || !result.studentDossierPath) throw new Error(result.error || "Could not generate the viva dossier.");
        setStatus("complete");
        window.location.assign(result.studentDossierPath);
        return;
      }
      setStatus("complete");
    } catch (cause) {
      ending.current = false;
      fail(cause);
    }
  }

  if (status === "loading") return <div className="viva-empty">Loading submission graph…</div>;
  if (!handoff) return <div className="viva-empty"><span className="wordmark">ELEZA</span><h1>No submission graph is loaded.</h1><p>Choose a fixture or parse a submission before beginning the viva.</p><a href="/">Return to submission</a></div>;

  const label = status === "live" ? "LIVE" : status === "connecting" ? "CONNECTING" : status === "ending" ? "ENDING" : status === "complete" ? "ENDED" : "READY";
  const durationMinutes = Math.round((handoff.durationMs ?? VIVA_DURATION_MS) / 60_000);
  const durationLabel = (handoff.durationMs ?? VIVA_DURATION_MS) === 120_000 ? "about two minutes" : `${durationMinutes} minutes`;
  const isTextMode = handoff.deliveryMode === "text";
  const isCode = handoff.profileId === "code";
  const health = isTextMode ? "typed-answer mode" : stallCount === 0 ? `${Math.round(maxDeadAirMs)} ms max handoff` : `${stallCount} handoff${stallCount === 1 ? "" : "s"} over 2s`;

  return <div className="viva-shell">
    <nav className="viva-nav"><div><span className="wordmark">ELEZA</span><i /><span className="mast-title">{handoff.title}</span></div><div className="viva-clock"><span className={`live-dot ${status === "live" ? "active" : ""}`} />{label}<b>{formatElapsed(elapsedMs)}</b></div></nav>
    <div className="viva-disclosure">You’re interacting with an AI examiner. {handoff.practice ? "This warm-up is not recorded or saved." : "Your transcript and examiner decisions are recorded and shown in your dossier."}</div>

    <main className="viva-main viva-reasoning-layout">
      <section className="transcript-column">
        {isCode && <CodeSourcePanel sourceText={handoff.sourceText} graph={handoff.graph} activeTargetId={activeTargetId} decisionLog={decisionLog} />}
        <p className="column-label">TRANSCRIPT</p>
        {turns.length === 0 && <div className="viva-ready-copy"><h1>{handoff.practice ? "Warm up first." : isCode ? "Defend the decisions." : "Defend the argument."}</h1><p>The AI examiner asks only questions tied to this {isCode ? "program’s parsed design decisions" : "essay’s parsed claims"}. {isTextMode ? "Type each answer and send it when complete." : "Answer out loud, then press Finish answer when you are done."} The session lasts {durationLabel}.</p>{!handoff.practice && <p className="viva-clamp-note">Real vivas are teacher-configurable at 5–8 minutes. This hosted demo is capped at about two minutes as a public-cost control.</p>}{handoff.sourceKind === "paste" && <p className="viva-data-note">Your text and transcript are stored to generate your dossier.</p>}<p className="viva-start-disclosure">AI INTERACTION · {handoff.practice ? "UNRECORDED PRACTICE" : "TRANSCRIPT AND ROUTING RECEIPTS RECORDED"}</p><button onClick={startLiveSession} disabled={status === "connecting"}>{status === "connecting" ? "Connecting…" : `Start ${handoff.practice ? "warm-up" : "viva"} — ${durationLabel}`}</button></div>}
        {turns.map((turn) => <article className={`transcript-turn ${turn.speaker}`} key={turn.id}>
          <time>{formatElapsed(turn.elapsedMs)}</time><div><small>{turn.speaker.toUpperCase()}{turn.targetClaimId ? ` · ${turn.targetClaimId}${turn.questionKind === "bridge" ? " · BRIDGE" : ""}` : ""}</small><p>{turn.text}</p></div>
        </article>)}
        {draft && <article className={`transcript-turn ${draft.speaker} draft`}><time>LIVE</time><div><small>{draft.speaker.toUpperCase()}</small><p>{draft.text}</p></div></article>}
        {isTextMode && status === "live" && <form className="typed-answer-form" onSubmit={submitTypedAnswer}>
          <label htmlFor="typed-answer">Your answer</label>
          <textarea id="typed-answer" value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder={isCode ? "Explain why you chose this structure and what could break…" : "Explain the claim in your own words…"} rows={4} autoFocus />
          <button type="submit" disabled={!typedAnswer.trim()}>Send answer</button>
        </form>}
        {status === "complete" && <div className="viva-complete-rule">{handoff.practice ? <>Warm-up complete. Nothing from this session was saved. <a href="/">Return to the judge demo</a>.</> : <>Viva complete. {decisionLog.length} examiner decisions recorded.</>}</div>}
      </section>

      <aside className="reasoning-pane">
        <p className="column-label">EXAMINER — LIVE REASONING</p>
        <UnderstandingMap graph={handoff.graph} decisionLog={decisionLog} profileId={handoff.profileId ?? "essay"} compact />
        {decisionLog.length === 0 && pendingDecisions === 0 && <p className="reasoning-empty">Specific routing receipts will appear after each completed answer.</p>}
        {decisionLog.map((entry) => <article className="reasoning-entry" data-decision-id={entry.id} key={entry.id}>
          <time>{formatElapsed(entry.answered_at_ms)}</time>
          <div className="reasoning-route"><span>{entry.target_claim_id}</span><b>{entry.action}</b><span>→ {entry.next_claim_id}</span></div>
          <p>{entry.rationale}</p>
          {handoff.graph.nodes.find((node) => node.id === entry.target_claim_id && isPrimaryNode(node, handoff.profileId ?? "essay")) && <MetaVivaExchange decision={entry} targetClaim={handoff.graph.nodes.find((node) => node.id === entry.target_claim_id && isPrimaryNode(node, handoff.profileId ?? "essay"))!} profileId={handoff.profileId ?? "essay"} />}
        </article>)}
        {pendingDecisions > 0 && <div className="reasoning-pending"><span>deciding</span><b>···</b><small>{pendingDecisions} answer{pendingDecisions === 1 ? "" : "s"} processing</small></div>}
      </aside>
    </main>

    {error && <p className="viva-error" role="alert">{error}</p>}
    <footer className="viva-controls"><div><span className={phase === "listening" && status === "live" ? "active" : ""}>{isTextMode ? "ANSWERING" : "LISTENING"}</span><i /><span className={phase === "speaking" && status === "live" ? "active" : ""}>{isTextMode ? "QUESTION" : "SPEAKING"}</span><i /><span className={phase === "thinking" && status === "live" ? "active" : ""}>THINKING</span></div><div className="viva-health"><span>{health}</span>{status === "live" && !isTextMode && <button className="finish-answer-button" onClick={finishVoiceAnswer} disabled={phase !== "listening"}>Finish answer</button>}{status === "live" && <button onClick={() => void endViva()}>End {handoff.practice ? "warm-up" : "viva"} early</button>}</div></footer>
  </div>;
}
