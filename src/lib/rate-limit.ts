import { createHash } from "node:crypto";
import { z } from "zod";
import { claimGraphSchema, type ClaimGraph } from "@/lib/claim-graph";
import { serviceClient } from "@/lib/decision-log";
import { profileIdSchema, type ProfileId } from "@/lib/domain-profile";
import { judgeDailyCap } from "@/lib/judge-access";

const creationResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(["allowed", "ip_daily_cap", "global_daily_cap", "judge_daily_cap"]),
  viva_session_id: z.string().uuid().nullable(),
  ip_count: z.number().int().nonnegative(),
  global_count: z.number().int().nonnegative(),
  applied_duration_limit_ms: z.number().int().min(30_000).max(150_000),
});

const tokenResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(["allowed", "ip_daily_cap", "global_daily_cap", "judge_daily_cap", "session_not_available", "session_expired"]),
  ip_token_count: z.number().int().nonnegative(),
  global_token_count: z.number().int().nonnegative(),
});

export type PublicSessionResult = z.infer<typeof creationResultSchema>;
export type TokenAuthorizationResult = z.infer<typeof tokenResultSchema>;

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? "local-or-unknown";
  return forwarded.split(",")[0].trim();
}

export function hashClientIp(request: Request) {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privacy-preserving rate limiting.");
  // DECISION: only a service-key-salted digest reaches Postgres; raw visitor IP addresses are never stored.
  return createHash("sha256").update(`${salt}:${clientIp(request)}`).digest("hex");
}

function globalDailyCap() {
  const parsed = Number(process.env.DEMO_GLOBAL_DAILY_CAP);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 200;
}

export function nextDailyRetryAt(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

export async function createPublicVivaSession(args: {
  request: Request;
  graph: ClaimGraph;
  sourceText: string;
  title: string;
  submissionId?: string;
  profileId?: ProfileId;
  durationMs?: number;
  sessionKind?: "judge" | "practice";
  judgeAccess?: boolean;
}): Promise<PublicSessionResult> {
  const result = await serviceClient().rpc("create_public_viva_session", {
    p_ip_hash: hashClientIp(args.request),
    p_graph: claimGraphSchema.parse(args.graph),
    p_source_text: args.sourceText,
    p_title: args.title,
    p_submission_id: args.submissionId ?? null,
    p_profile_id: profileIdSchema.parse(args.profileId ?? "essay"),
    p_duration_limit_ms: Math.min(args.durationMs ?? 120_000, 150_000),
    p_session_kind: args.sessionKind ?? "judge",
    p_global_limit: globalDailyCap(),
    p_rate_limit_tier: args.judgeAccess ? "judge_code" : "public",
    p_judge_limit: judgeDailyCap(),
  });
  if (result.error) throw new Error(`Could not create rate-limited viva: ${result.error.message}`);
  return creationResultSchema.parse(Array.isArray(result.data) ? result.data[0] : result.data);
}

export async function authorizeRealtimeToken(request: Request, sessionId: string): Promise<TokenAuthorizationResult> {
  const result = await serviceClient().rpc("authorize_realtime_token", {
    p_session_id: z.string().uuid().parse(sessionId),
    p_ip_hash: hashClientIp(request),
    p_global_limit: globalDailyCap(),
    p_judge_limit: judgeDailyCap(),
  });
  if (result.error) throw new Error(`Could not authorize Realtime token: ${result.error.message}`);
  return tokenResultSchema.parse(Array.isArray(result.data) ? result.data[0] : result.data);
}

export async function closePracticeSession(request: Request, sessionId: string) {
  const result = await serviceClient().from("viva_sessions")
    .update({ status: "abandoned" })
    .eq("id", z.string().uuid().parse(sessionId))
    .eq("request_ip_hash", hashClientIp(request))
    .eq("session_kind", "practice")
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(`Could not close practice session: ${result.error.message}`);
  if (!result.data) throw new Error("This practice session is not available.");
}
