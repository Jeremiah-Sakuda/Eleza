import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { POST } from "@/app/api/viva/sessions/route";
import { serviceClient } from "@/lib/decision-log";
import { judgeDemoGraph } from "@/lib/demo-fixtures";
import { authorizeRealtimeToken } from "@/lib/rate-limit";

async function main() {
  process.env.DEMO_GLOBAL_DAILY_CAP = "100000";
  const sourceText = await readFile(path.join(process.cwd(), "fixtures", "community-gardens-argument.txt"), "utf8");
  const graph = judgeDemoGraph(sourceText);
  const ip = `2001:db8::${Date.now().toString(16)}`;
  const sessionIds: string[] = [];

  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const request = new Request("https://eleza.example/api/viva/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-vercel-forwarded-for": ip },
      body: JSON.stringify({ graph, sourceText, title: "Rate-limit acceptance fixture", durationMs: 999_999 }),
    });
    const response = await POST(request);
    const body = await response.json() as { id?: string; durationLimitMs?: number; code?: string; error?: string };
    if (attempt <= 5) {
      assert.equal(response.status, 200, body.error);
      assert.ok(body.id, `Session ${attempt} was not created.`);
      assert.equal(body.durationLimitMs, 150_000, "The server did not apply the judge-session hard ceiling.");
      sessionIds.push(body.id);
    } else {
      assert.equal(response.status, 429, "The sixth session was not blocked.");
      assert.equal(body.code, "ip_daily_cap");
      assert.equal(response.headers.get("Retry-After"), "86400");
    }
  }

  const tokenRequest = new Request("https://eleza.example/api/realtime/token", { headers: { "x-vercel-forwarded-for": ip } });
  for (const sessionId of sessionIds) {
    const authorization = await authorizeRealtimeToken(tokenRequest, sessionId);
    assert.equal(authorization.allowed, true, `Token for ${sessionId} was refused before the cap.`);
  }
  const sixthToken = await authorizeRealtimeToken(tokenRequest, sessionIds[0]);
  assert.equal(sixthToken.allowed, false, "The sixth Realtime token was not blocked.");
  assert.equal(sixthToken.reason, "ip_daily_cap");

  const cleanup = await serviceClient().from("viva_sessions").update({ status: "abandoned" }).in("id", sessionIds);
  if (cleanup.error) throw new Error(`Could not close acceptance sessions: ${cleanup.error.message}`);
  console.log(`Rate-limit acceptance passed: session and token attempts six were blocked for ${ip}; the configured hard ceiling was applied.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
