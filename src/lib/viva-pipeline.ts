import { z } from "zod";
import { claimGraphSchema, type ClaimGraph } from "@/lib/claim-graph";
import { examinerDecisionSchema, type ExaminerDecision } from "@/lib/examiner-schema";

export const VIVA_DURATION_MS = 300_000;
export const DEAD_AIR_LIMIT_MS = 2_000;
const PREFETCHED_BRIDGE_COUNT = 64;

export const vivaQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(5),
  targetClaimId: z.string(),
  kind: z.enum(["opening", "bridge", "adaptive"]),
  sourceDecisionSequence: z.number().int().nonnegative().optional(),
});

export type VivaQuestion = z.infer<typeof vivaQuestionSchema>;

function claims(graph: ClaimGraph) {
  return graph.nodes.filter((node) => node.type === "claim");
}

export function assertQuestionTrace(question: VivaQuestion, graph: ClaimGraph) {
  vivaQuestionSchema.parse(question);
  if (!claims(graph).some((node) => node.id === question.targetClaimId)) {
    throw new Error(`Question ${question.id} does not trace to a claim node.`);
  }
  return question;
}

export function openingQuestion(graph: ClaimGraph): VivaQuestion {
  const parsed = claimGraphSchema.parse(graph);
  const target = claims(parsed)[0];
  if (!target) throw new Error("A viva requires at least one claim node.");
  return assertQuestionTrace({
    id: "opening-0",
    kind: "opening",
    targetClaimId: target.id,
    text: `Begin with this claim: “${target.label}” Explain the mechanism in your own words.`,
  }, parsed);
}

export function prefetchBridgeQuestions(graph: ClaimGraph, count = PREFETCHED_BRIDGE_COUNT): VivaQuestion[] {
  const parsed = claimGraphSchema.parse(graph);
  const claimNodes = claims(parsed);
  if (!claimNodes.length) throw new Error("A viva requires at least one claim node.");
  // DECISION: bridges are deterministic and precomputed, so examiner latency can never grant the voice model routing authority.
  return Array.from({ length: count }, (_, index) => {
    const target = claimNodes[(index + 1) % claimNodes.length];
    return assertQuestionTrace({
      id: `bridge-${index}`,
      kind: "bridge",
      targetClaimId: target.id,
      text: `While I consider that answer, turn to this claim: “${target.label}” What role does it play in the argument?`,
    }, parsed);
  });
}

export class VivaQuestionPipeline {
  private readonly bridges: VivaQuestion[];
  private bridgeIndex = 0;
  private readonly adaptive: VivaQuestion[] = [];

  constructor(private readonly graph: ClaimGraph) {
    this.graph = claimGraphSchema.parse(graph);
    this.bridges = prefetchBridgeQuestions(this.graph);
  }

  opening() { return openingQuestion(this.graph); }

  acceptDecision(decision: ExaminerDecision, sequence: number) {
    const parsed = examinerDecisionSchema.parse(decision);
    this.adaptive.push(assertQuestionTrace({
      id: `adaptive-${sequence}`,
      kind: "adaptive",
      targetClaimId: parsed.next_claim_id,
      text: parsed.next_question,
      sourceDecisionSequence: sequence,
    }, this.graph));
  }

  nextImmediate(): VivaQuestion {
    const routed = this.adaptive.shift();
    if (routed) return routed;
    const bridge = this.bridges[this.bridgeIndex % this.bridges.length];
    this.bridgeIndex += 1;
    return bridge;
  }
}
