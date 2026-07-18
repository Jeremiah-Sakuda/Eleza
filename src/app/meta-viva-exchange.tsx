"use client";

import { useState } from "react";
import type { ClaimGraphNode } from "@/lib/claim-graph";
import type { DecisionLogEntry } from "@/lib/decision-log";
import type { MetaVivaMessage } from "@/lib/meta-viva";
import type { ProfileId } from "@/lib/domain-profile";

export function MetaVivaExchange({ decision, targetClaim, profileId = "essay" }: { decision: DecisionLogEntry; targetClaim: ClaimGraphNode; profileId?: ProfileId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<MetaVivaMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const userTurns = messages.filter((message) => message.role === "user").length;

  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = question.trim();
    if (!clean || loading || userTurns >= 3) return;
    const nextMessages: MetaVivaMessage[] = [...messages, { role: "user", content: clean }];
    setMessages(nextMessages);
    setQuestion("");
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/meta-viva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, target_claim: targetClaim, profile_id: profileId, messages: nextMessages }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || "This routing decision could not be examined.");
      setMessages((current) => [...current, { role: "assistant", content: result.answer! }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This routing decision could not be examined.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="meta-viva">
    <button className="meta-viva-toggle" type="button" onClick={() => setOpen((current) => !current)}>Question this decision</button>
    {open && <div className="meta-viva-panel">
      <strong>Eleza holds itself to the standard it holds students to.</strong>
      {messages.length === 0 && <p>Ask why this route was chosen or what the cited answer phrase established.</p>}
      {messages.map((message, index) => <p className={`meta-viva-message ${message.role}`} key={`${message.role}-${index}`}><b>{message.role === "user" ? "YOU" : "ELEZA"}</b>{message.content}</p>)}
      {error && <p className="meta-viva-error" role="alert">{error}</p>}
      {userTurns < 3 ? <form onSubmit={ask}>
        <label htmlFor={`meta-viva-${decision.id}`}>Question {userTurns + 1} of 3</label>
        <textarea id={`meta-viva-${decision.id}`} value={question} onChange={(event) => setQuestion(event.target.value)} rows={2} maxLength={800} />
        <button type="submit" disabled={loading || !question.trim()}>{loading ? "Grounding answer…" : "Ask"}</button>
      </form> : <small>Three-question exchange complete.</small>}
    </div>}
  </div>;
}
