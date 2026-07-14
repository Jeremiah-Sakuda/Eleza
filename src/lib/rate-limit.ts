import { createHash } from "node:crypto";
import { z } from "zod";
import { serviceClient } from "@/lib/decision-log";

const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(["allowed", "ip_daily_cap", "global_daily_cap"]),
  ip_count: z.number().int().nonnegative(),
  global_count: z.number().int().nonnegative(),
});

export type RateLimitResult = z.infer<typeof rateLimitResultSchema>;

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? request.headers.get("x-real-ip")
    ?? "local-or-unknown";
  return forwarded.split(",")[0].trim();
}

export function hashClientIp(request: Request) {
  const salt = process.env.RATE_LIMIT_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!salt) throw new Error("RATE_LIMIT_SALT or SUPABASE_SERVICE_ROLE_KEY is required for privacy-preserving rate limiting.");
  // DECISION: only a salted digest reaches Postgres; raw visitor IP addresses are never stored.
  return createHash("sha256").update(`${salt}:${clientIp(request)}`).digest("hex");
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function claimDemoSession(request: Request): Promise<RateLimitResult> {
  const result = await serviceClient().rpc("claim_demo_session", {
    p_ip_hash: hashClientIp(request),
    p_ip_limit: positiveInteger(process.env.DEMO_IP_DAILY_CAP, 5),
    p_global_limit: positiveInteger(process.env.DEMO_GLOBAL_DAILY_CAP, 100),
  });
  if (result.error) throw new Error(`Could not evaluate demo rate limit: ${result.error.message}`);
  return rateLimitResultSchema.parse(Array.isArray(result.data) ? result.data[0] : result.data);
}
