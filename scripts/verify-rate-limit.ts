import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { POST } from "@/app/api/viva/sessions/route";
import { serviceClient } from "@/lib/decision-log";
import { judgeDemoGraph } from "@/lib/demo-fixtures";

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
      body: JSON.stringify({ graph, sourceText, title: "Rate-limit acceptance fixture" }),
    });
    const response = await POST(request);
    const body = await response.json() as { id?: string; code?: string; error?: string };
    if (attempt <= 5) {
      assert.equal(response.status, 200, body.error);
      assert.ok(body.id, `Session ${attempt} was not created.`);
      sessionIds.push(body.id);
    } else {
      assert.equal(response.status, 429, "The sixth session was not blocked.");
      assert.equal(body.code, "ip_daily_cap");
      assert.equal(response.headers.get("Retry-After"), "86400");
    }
  }

  const cleanup = await serviceClient().from("viva_sessions").update({ status: "abandoned" }).in("id", sessionIds);
  if (cleanup.error) throw new Error(`Could not close acceptance sessions: ${cleanup.error.message}`);
  console.log(`Rate-limit acceptance passed: five sessions allowed and attempt six blocked for ${ip}.`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
