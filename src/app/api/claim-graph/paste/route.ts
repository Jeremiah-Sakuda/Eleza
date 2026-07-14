import { NextResponse } from "next/server";
import { z } from "zod";
import { generateClaimGraph } from "@/lib/generate-claim-graph";
import { validatePasteGraph, validatePasteLength } from "@/lib/paste-submission";
import { persistClaimGraph } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

const inputSchema = z.object({ text: z.string() });

export async function POST(request: Request) {
  try {
    const { text } = inputSchema.parse(await request.json());
    validatePasteLength(text);
    const graph = validatePasteGraph(await generateClaimGraph(text, { minimumClaimCount: 4 }));
    const persistence = await persistClaimGraph("pasted-argument.txt", text, graph);
    return NextResponse.json({ sourceText: text, graph, persistence });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "This text could not be mapped into an argument." }, { status: 422 });
  }
}
