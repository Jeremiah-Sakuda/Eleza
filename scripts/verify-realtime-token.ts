import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { POST as createToken } from "@/app/api/realtime/token/route";
import { POST as createSession } from "@/app/api/viva/sessions/route";
import { serviceClient } from "@/lib/decision-log";
import { judgeDemoGraph } from "@/lib/demo-fixtures";

async function main() {
  process.env.DEMO_GLOBAL_DAILY_CAP = "100000";
  const sourceText = await readFile(path.join(process.cwd(), "fixtures", "community-gardens-argument.txt"), "utf8");
  const ip = `2001:db8::${Date.now().toString(16)}`;
  const headers = { "Content-Type": "application/json", "x-vercel-forwarded-for": ip };
  let sessionId: string | undefined;

  try {
    const sessionResponse = await createSession(new Request("https://eleza.example/api/viva/sessions", {
      method: "POST",
      headers,
      body: JSON.stringify({
        graph: judgeDemoGraph(sourceText),
        sourceText,
        title: "Realtime token acceptance fixture",
        durationMs: 120_000,
      }),
    }));
    const session = await sessionResponse.json() as { id?: string; error?: string };
    assert.equal(sessionResponse.status, 200, session.error);
    assert.ok(session.id, "The acceptance viva session was not created.");
    sessionId = session.id;

    const issuedAt = Math.floor(Date.now() / 1000);
    const tokenResponse = await createToken(new Request("https://eleza.example/api/realtime/token", {
      method: "POST",
      headers,
      body: JSON.stringify({ sessionId }),
    }));
    const token = await tokenResponse.json() as { value?: string; expiresAt?: number; error?: string };
    assert.equal(tokenResponse.status, 200, token.error);
    assert.ok(token.value, "OpenAI did not mint an ephemeral Realtime client token.");
    assert.ok(token.expiresAt, "The ephemeral token did not include an expiry.");
    const ttlSeconds = token.expiresAt - issuedAt;
    assert.ok(ttlSeconds > 0 && ttlSeconds <= 15, `Expected OpenAI's 10-second minimum Realtime token lifetime; received ${ttlSeconds} seconds.`);
    assert.equal(tokenResponse.headers.get("Cache-Control"), "no-store");
    console.log(`Realtime token acceptance passed: a client token was minted with a ${ttlSeconds}-second lifetime; its value was not printed.`);
  } finally {
    if (sessionId) {
      const cleanup = await serviceClient().from("viva_sessions").update({ status: "abandoned" }).eq("id", sessionId);
      if (cleanup.error) throw new Error(`Could not close the acceptance session: ${cleanup.error.message}`);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
