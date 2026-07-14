import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { ClaimGraphNode } from "@/lib/claim-graph";
import { appendDecisionLog, completeVivaSession, createVivaSession } from "@/lib/decision-log";
import { examineAnswer, evaluateRationale, evaluateRouting } from "@/lib/examiner";
import { generateClaimGraph } from "@/lib/generate-claim-graph";
import {
  assertQuestionTrace,
  DEAD_AIR_LIMIT_MS,
  VivaQuestionPipeline,
  VIVA_DURATION_MS,
} from "@/lib/viva-pipeline";

async function main() {
  for (const name of ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
    if (!process.env[name]) throw new Error(`${name} is required.`);
  }

  const sourceText = await readFile(path.join(process.cwd(), "fixtures/community-gardens-argument.txt"), "utf8");
  const answers = JSON.parse(await readFile(path.join(process.cwd(), "fixtures/viva-answers.json"), "utf8")) as string[];
  const graph = await generateClaimGraph(sourceText);
  const claimCount = graph.nodes.filter((node) => node.type === "claim").length;
  assert.ok(claimCount >= 6, `Fixture graph has only ${claimCount} claim nodes.`);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  for (let run = 1; run <= 3; run += 1) {
    const session = await createVivaSession(graph);
    const pipeline = new VivaQuestionPipeline(graph);
    let question = pipeline.opening();
    let maxDispatchMs = 0;

    for (let sequence = 0; sequence < answers.length; sequence += 1) {
      assertQuestionTrace(question, graph);
      const target = graph.nodes.find((node): node is ClaimGraphNode =>
        node.type === "claim" && node.id === question.targetClaimId);
      assert.ok(target, `Run ${run}, question ${sequence} lost its target claim.`);
      const transcript = answers[sequence];
      const answeredAtMs = Math.round(((sequence + 1) / answers.length) * VIVA_DURATION_MS);

      const examinerPromise = examineAnswer({ transcript_segment: transcript, target_claim: target, graph });
      const dispatchStarted = performance.now();
      const bridgeOrReadyDecision = pipeline.nextImmediate();
      const dispatchMs = performance.now() - dispatchStarted;
      maxDispatchMs = Math.max(maxDispatchMs, dispatchMs);
      assert.ok(dispatchMs < DEAD_AIR_LIMIT_MS, `Run ${run} exceeded the bridge dispatch limit.`);
      assertQuestionTrace(bridgeOrReadyDecision, graph);

      const decision = await examinerPromise;
      assert.equal(decision.quality_gate.status, "passed", `Run ${run}, decision ${sequence} failed the rationale gate.`);
      assert.deepEqual(evaluateRationale(decision, { transcript_segment: transcript, target_claim: target, graph }), []);
      assert.deepEqual(evaluateRouting(decision, { transcript_segment: transcript, target_claim: target, graph }), []);
      await appendDecisionLog({
        sessionId: session.id,
        sequence,
        transcriptSegment: transcript,
        answeredAtMs,
        decision,
      });
      pipeline.acceptDecision(decision, sequence);
      question = bridgeOrReadyDecision;
    }

    await completeVivaSession(session.id);
    const logged = await supabase.from("decision_log")
      .select("target_claim_id, rationale, sequence")
      .eq("viva_session_id", session.id)
      .order("sequence");
    if (logged.error) throw new Error(logged.error.message);
    assert.equal(logged.data.length, answers.length, `Run ${run} did not persist every decision.`);
    assert.ok(logged.data.every((entry) => entry.rationale.includes(entry.target_claim_id)), `Run ${run} contains a generic rationale.`);
    console.log(`Run ${run}/3 complete: session ${session.id}, ${logged.data.length} persisted decisions, ${maxDispatchMs.toFixed(1)} ms max bridge dispatch.`);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
