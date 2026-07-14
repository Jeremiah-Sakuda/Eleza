import { NextResponse } from "next/server";
import { extractSubmissionText, assertUsableText } from "@/lib/extract-text";
import { generateClaimGraph } from "@/lib/generate-claim-graph";
import { persistClaimGraph } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a .txt or .pdf submission." }, { status: 400 });
    const sourceText = await extractSubmissionText(file);
    assertUsableText(sourceText);
    const graph = await generateClaimGraph(sourceText);
    const persistence = await persistClaimGraph(file.name, sourceText, graph);
    return NextResponse.json({ sourceText, graph, persistence });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate the claim graph.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
