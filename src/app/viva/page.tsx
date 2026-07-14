"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatElapsed,
  ScriptedQuestionDriver,
  SCRIPTED_QUESTIONS,
  TRANSPORT_PROOF_DURATION_MS,
  transportProofTimestamp,
  type TranscriptTurn,
} from "@/lib/scripted-viva";

type SessionStatus = "idle" | "connecting" | "live" | "proof" | "complete" | "error";

const PROOF_ANSWERS = [
  "The essay argues that gardens should be permanent civic infrastructure because several modest benefits reinforce each other.",
  "The mechanism is proximity: residents can supplement weekly ingredients without traveling as far.",
  "Repeated tasks require cooperation, and those low-pressure encounters give neighbors opportunities to build trust over time.",
  "Resilience includes an existing network of people who know how to coordinate tools, information, and checks on neighbors.",
  "The storm showed that the garden was an organizing point even though it could not replace store deliveries.",
  "The proposal prioritizes vacant lots and unsuitable parcels, so it does not treat needed housing sites as interchangeable with gardens.",
  "A three-year lease gives volunteers enough certainty to plan while annual reporting still lets the city transfer neglected sites.",
  "The strongest limitation is that gardens only supplement food access and cannot substitute for grocery stores or poverty policy.",
];

export default function VivaPage() {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [draft, setDraft] = useState<{ speaker: TranscriptTurn["speaker"]; text: string } | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState("");
  const [dropCount, setDropCount] = useState(0);
  const startedAt = useRef(0);
  const driver = useRef(new ScriptedQuestionDriver());
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (status !== "live") return;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt.current), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => stopTransport(), []);

  function appendTurn(speaker: TranscriptTurn["speaker"], text: string, at = Date.now() - startedAt.current) {
    const clean = text.trim();
    if (!clean) return;
    setTurns((current) => [...current, { id: `${speaker}-${current.length}-${at}`, speaker, text: clean, elapsedMs: at }]);
  }

  function stopTransport() {
    channel.current?.close();
    peer.current?.close();
    microphone.current?.getTracks().forEach((track) => track.stop());
    remoteAudio.current?.remove();
    channel.current = null; peer.current = null; microphone.current = null; remoteAudio.current = null;
  }

  function sendNextQuestion() {
    const next = driver.current.next();
    if (!next) {
      setElapsedMs(Date.now() - startedAt.current);
      setStatus("complete");
      stopTransport();
      return;
    }
    if (channel.current?.readyState !== "open") throw new Error("Realtime control channel is not open.");
    // DECISION: each response receives only the externally supplied question, so the voice model cannot choose the next move.
    channel.current.send(JSON.stringify({
      type: "response.create",
      response: {
        conversation: "none",
        metadata: { question_index: String(next.index) },
        input: [],
        output_modalities: ["audio"],
        instructions: next.question,
      },
    }));
  }

  function handleRealtimeEvent(event: MessageEvent<string>) {
    const message = JSON.parse(event.data) as Record<string, unknown>;
    const type = String(message.type ?? "");
    if (type === "response.output_audio_transcript.delta") {
      const delta = String(message.delta ?? "");
      setDraft((current) => ({ speaker: "examiner", text: current?.speaker === "examiner" ? current.text + delta : delta }));
    } else if (type === "response.output_audio_transcript.done") {
      appendTurn("examiner", String(message.transcript ?? "")); setDraft(null);
    } else if (type === "conversation.item.input_audio_transcription.delta") {
      const delta = String(message.delta ?? "");
      setDraft((current) => ({ speaker: "student", text: current?.speaker === "student" ? current.text + delta : delta }));
    } else if (type === "conversation.item.input_audio_transcription.completed" || type === "conversation.item.input_audio_transcription.done") {
      appendTurn("student", String(message.transcript ?? "")); setDraft(null);
      window.setTimeout(() => {
        try { sendNextQuestion(); } catch (cause) { fail(cause); }
      }, 120);
    } else if (type === "error") {
      fail(new Error(JSON.stringify(message.error ?? message)));
    }
  }

  function fail(cause: unknown) {
    setError(cause instanceof Error ? cause.message : "The Realtime session failed.");
    setStatus("error");
    stopTransport();
  }

  async function startLiveSession() {
    stopTransport(); setTurns([]); setDraft(null); setError(""); setDropCount(0); setStatus("connecting");
    driver.current = new ScriptedQuestionDriver(); startedAt.current = Date.now(); setElapsedMs(0);
    try {
      const pc = new RTCPeerConnection();
      const audio = document.createElement("audio"); audio.autoplay = true;
      pc.ontrack = (event) => { audio.srcObject = event.streams[0]; };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const dc = pc.createDataChannel("oai-events");
      dc.addEventListener("message", handleRealtimeEvent);
      dc.addEventListener("open", () => {
        setStatus("live");
        try { sendNextQuestion(); } catch (cause) { fail(cause); }
      });
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "disconnected") setDropCount((count) => count + 1);
        if (pc.connectionState === "failed") fail(new Error("WebRTC connection failed."));
      });
      peer.current = pc; channel.current = dc; microphone.current = stream; remoteAudio.current = audio;
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const response = await fetch("/api/realtime/session", { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp });
      if (!response.ok) throw new Error((await response.text()) || "Could not create Realtime session.");
      await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });
    } catch (cause) { fail(cause); }
  }

  async function runTransportProof() {
    stopTransport(); setTurns([]); setDraft(null); setError(""); setDropCount(0); setStatus("proof"); setElapsedMs(0);
    driver.current = new ScriptedQuestionDriver(); startedAt.current = Date.now();
    for (let index = 0; index < SCRIPTED_QUESTIONS.length; index += 1) {
      const scripted = driver.current.next();
      if (!scripted) break;
      const { examinerAt, studentAt } = transportProofTimestamp(index);
      appendTurn("examiner", scripted.question, examinerAt);
      appendTurn("student", PROOF_ANSWERS[index], studentAt);
      setElapsedMs(studentAt);
      await new Promise((resolve) => window.setTimeout(resolve, 90));
    }
    setElapsedMs(TRANSPORT_PROOF_DURATION_MS); setStatus("complete");
  }

  const sessionLabel = status === "live" ? "LIVE" : status === "connecting" ? "CONNECTING" : status === "proof" ? "PROOF RUNNING" : status === "complete" ? "ENDED" : status.toUpperCase();

  return <div className="viva-shell">
    <nav className="viva-nav"><div><span className="wordmark">ELEZA</span><i /><span className="mast-title">Community gardens and city planning</span></div><div className="viva-clock"><span className={`live-dot ${status === "live" ? "active" : ""}`} />{sessionLabel}<b>{formatElapsed(elapsedMs)}</b></div></nav>
    <div className="viva-disclosure">You’re speaking with an AI examiner. Everything is logged and shown.</div>
    <main className="viva-main">
      <section className="transcript-column"><p className="column-label">LIVE TRANSCRIPT</p>
        {turns.length === 0 && <p className="empty-transcript">Start a live session, or run the credential-free three-minute transport proof.</p>}
        {turns.map((turn) => <article className={`transcript-turn ${turn.speaker}`} key={turn.id}><time>{formatElapsed(turn.elapsedMs)}</time><div><small>{turn.speaker.toUpperCase()}</small><p>{turn.text}</p></div></article>)}
        {draft && <article className={`transcript-turn ${draft.speaker} draft`}><time>LIVE</time><div><small>{draft.speaker.toUpperCase()}</small><p>{draft.text}</p></div></article>}
      </section>
      <aside className="session-rail"><p className="column-label">SCRIPTED DRIVER</p><strong>{Math.min(turns.filter((turn) => turn.speaker === "examiner").length, SCRIPTED_QUESTIONS.length)} / {SCRIPTED_QUESTIONS.length}</strong><p>Questions delivered programmatically. The voice model does not select them.</p>
        <div className="health" data-testid="session-health"><span>SESSION HEALTH</span><b>{status === "complete" && elapsedMs >= TRANSPORT_PROOF_DURATION_MS ? "Transport proof passed" : status === "live" ? "Connected" : "Waiting"}</b><small>{formatElapsed(elapsedMs)} · {dropCount} drops</small></div>
      </aside>
    </main>
    {error && <p className="viva-error" role="alert">{error}</p>}
    <footer className="viva-controls"><div><span className={status === "live" ? "active" : ""}>LISTENING</span><i /><span>SPEAKING</span><i /><span>THINKING</span></div><div><button onClick={runTransportProof} disabled={status === "live" || status === "connecting" || status === "proof"}>Run 3-minute transport proof</button><button onClick={startLiveSession} disabled={status === "live" || status === "connecting" || status === "proof"}>Start live viva</button></div></footer>
  </div>;
}
