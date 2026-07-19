import { z } from "zod";
import { claimGraphSchema, isPrimaryNode, type ClaimGraph } from "@/lib/claim-graph";
import { examinerDecisionSchema, type ExaminerDecision } from "@/lib/examiner-schema";
import { type ProfileId } from "@/lib/domain-profile";

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

export function renderVoiceQuestionInstruction(template: string, question: VivaQuestion) {
  assertQuestionText(question.text);
  if (!template.includes("{{QUESTION}}")) throw new Error("Realtime question template is missing {{QUESTION}}.");
  return template.replaceAll("{{QUESTION}}", question.text);
}

function assertQuestionText(text: string) {
  if (text.includes("<question>") || text.includes("</question>")) {
    throw new Error("Routed question contains reserved delivery tags.");
  }
}

function claims(graph: ClaimGraph, profileId: ProfileId = "essay") {
  return graph.nodes.filter((node) => isPrimaryNode(node, profileId));
}

export function assertQuestionTrace(question: VivaQuestion, graph: ClaimGraph, profileId: ProfileId = "essay") {
  vivaQuestionSchema.parse(question);
  assertQuestionText(question.text);
  if (!claims(graph, profileId).some((node) => node.id === question.targetClaimId)) {
    throw new Error(`Question ${question.id} does not trace to an examinable graph node.`);
  }
  return question;
}

export function openingQuestion(graph: ClaimGraph, profileId: ProfileId = "essay"): VivaQuestion {
  const parsed = claimGraphSchema.parse(graph);
  const target = claims(parsed, profileId)[0];
  if (!target) throw new Error("A viva requires at least one examinable graph node.");
  const text = openingQuestionText(target.label, target.type, profileId);
  return assertQuestionTrace({
    id: "opening-0",
    kind: "opening",
    targetClaimId: target.id,
    text,
  }, parsed, profileId);
}

export function prefetchBridgeQuestions(graph: ClaimGraph, count = PREFETCHED_BRIDGE_COUNT, profileId: ProfileId = "essay"): VivaQuestion[] {
  const parsed = claimGraphSchema.parse(graph);
  const claimNodes = claims(parsed, profileId);
  if (!claimNodes.length) throw new Error("A viva requires at least one examinable graph node.");
  // DECISION: bridges are deterministic and precomputed, so examiner latency can never grant the voice model routing authority.
  return Array.from({ length: count }, (_, index) => {
    const target = claimNodes[(index + 1) % claimNodes.length];
    const text = bridgeQuestionText(target.label, target.type, profileId);
    return assertQuestionTrace({
      id: `bridge-${index}`,
      kind: "bridge",
      targetClaimId: target.id,
      text,
    }, parsed, profileId);
  });
}

function openingQuestionText(label: string, nodeType: string, profileId: ProfileId) {
  if (profileId === "code") return `Begin with this design decision: “${label}” Why did you choose this structure, and what input would make it break?`;
  if (profileId === "lab_report") return `Begin with this ${nodeType.replaceAll("_", " ")}: “${label}” Which result or control bears on it, and what outcome would have weakened it?`;
  if (profileId === "case_analysis") return `Begin with this ${nodeType.replaceAll("_", " ")}: “${label}” Which assumption does it depend on, and what happens if that assumption is wrong?`;
  return `Begin with this claim: “${label}” Explain the mechanism in your own words.`;
}

function bridgeQuestionText(label: string, nodeType: string, profileId: ProfileId) {
  if (profileId === "code") return `While I consider that answer, turn to this decision: “${label}” What alternative did you reject, and what would break if this choice changed?`;
  if (profileId === "lab_report") return `While I consider that answer, turn to this ${nodeType.replaceAll("_", " ")}: “${label}” Why does the reported evidence support it, and where is the limit?`;
  if (profileId === "case_analysis") return `While I consider that answer, turn to this ${nodeType.replaceAll("_", " ")}: “${label}” Which assumption is carrying the recommendation here?`;
  return `While I consider that answer, turn to this claim: “${label}” What role does it play in the argument?`;
}

export class VivaQuestionPipeline {
  private readonly bridges: VivaQuestion[];
  private bridgeIndex = 0;
  private readonly adaptive: VivaQuestion[] = [];

  constructor(private readonly graph: ClaimGraph, private readonly profileId: ProfileId = "essay") {
    this.graph = claimGraphSchema.parse(graph);
    this.bridges = prefetchBridgeQuestions(this.graph, PREFETCHED_BRIDGE_COUNT, this.profileId);
  }

  opening() { return openingQuestion(this.graph, this.profileId); }

  acceptDecision(decision: ExaminerDecision, sequence: number) {
    const parsed = examinerDecisionSchema.parse(decision);
    this.adaptive.push(assertQuestionTrace({
      id: `adaptive-${sequence}`,
      kind: "adaptive",
      targetClaimId: parsed.next_claim_id,
      text: parsed.next_question,
      sourceDecisionSequence: sequence,
    }, this.graph, this.profileId));
  }

  nextImmediate(): VivaQuestion {
    const routed = this.adaptive.shift();
    if (routed) return routed;
    const bridge = this.bridges[this.bridgeIndex % this.bridges.length];
    this.bridgeIndex += 1;
    return bridge;
  }
}
