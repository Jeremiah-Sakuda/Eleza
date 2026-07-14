import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { MODELS } from "@/lib/models";
import { hashClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is required for a live voice session." }, { status: 503 });
  }
  const sdp = await request.text();
  if (!sdp.trim()) return NextResponse.json({ error: "Missing WebRTC session description." }, { status: 400 });

  const instructions = await readFile(path.join(process.cwd(), "prompts", "realtime-voice.md"), "utf8");
  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify({
    type: "realtime",
    model: MODELS.realtime,
    output_modalities: ["audio"],
    instructions,
    audio: {
      input: {
        transcription: { model: "gpt-realtime-whisper" },
        turn_detection: {
          type: "semantic_vad",
          create_response: false,
          interrupt_response: false,
        },
      },
      output: { voice: "marin" },
    },
  }));

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "OpenAI-Safety-Identifier": hashClientIp(request),
    },
    body: form,
  });
  const body = await response.text();
  if (!response.ok) return new NextResponse(body, { status: response.status });
  return new NextResponse(body, { headers: { "Content-Type": "application/sdp" } });
}
