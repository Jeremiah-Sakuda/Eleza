import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const template = await readFile(path.join(process.cwd(), "prompts", "realtime-question.md"), "utf8");
  return NextResponse.json({ template });
}
