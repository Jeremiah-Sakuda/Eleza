import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const sourceText = await readFile(path.join(process.cwd(), "fixtures", "community-gardens-argument.txt"), "utf8");
  return NextResponse.json({ filename: "community-gardens-argument.txt", sourceText });
}
