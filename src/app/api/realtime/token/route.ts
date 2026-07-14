import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { MODELS } from "@/lib/models";
import { authorizeRealtimeToken, hashClientIp, nextDailyRetryAt } from "@/lib/rate-limit";

export const runtime = "nodejs";

const inputSchema = z.object({ sessionId: z.string().uuid() });
const tokenSchema = z.object({ value: z.string().min(1), expires_at: z.number().int().positive() });

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Realtime voice is not configured." }, { status: 503 });
    const { sessionId } = inputSchema.parse(await request.json());
    const authorization = await authorizeRealtimeToken(request, sessionId);
    if (!authorization.allowed) {
      if (authorization.reason === "session_not_available") return NextResponse.json({ error: "This voice session is not available." }, { status: 403 });
      if (authorization.reason === "session_expired") return NextResponse.json({ error: "This voice session has ended." }, { status: 410 });
      const retryAt = nextDailyRetryAt();
      return NextResponse.json({
        error: authorization.reason === "ip_daily_cap"
          ? `Daily voice-token limit reached for this connection. Try again after ${retryAt}.`
          : `Daily voice-token capacity reached. Try again after ${retryAt}.`,
        code: authorization.reason,
        retryAt,
      }, { status: 429, headers: { "Retry-After": "86400" } });
    }

    const instructions = await readFile(path.join(process.cwd(), "prompts", "realtime-voice.md"), "utf8");
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": hashClientIp(request),
      },
      body: JSON.stringify({
        // DECISION: Explicitly request OpenAI's 10-second minimum instead of the current 10-minute default.
        expires_after: { anchor: "created_at", seconds: 10 },
        session: {
          type: "realtime",
          model: MODELS.realtime,
          output_modalities: ["audio"],
          instructions,
          audio: {
            input: {
              transcription: { model: "gpt-realtime-whisper" },
              turn_detection: { type: "semantic_vad", create_response: false, interrupt_response: false },
            },
            output: { voice: "marin" },
          },
        },
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "Realtime token could not be created." }, { status: 502 });
    const token = tokenSchema.parse(await response.json());
    return NextResponse.json({ value: token.value, expiresAt: token.expires_at }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Realtime token could not be created." }, { status: 422 });
  }
}
