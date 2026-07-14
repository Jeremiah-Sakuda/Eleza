import { NextResponse } from "next/server";
import { z } from "zod";
import { completeVivaSession } from "@/lib/decision-log";
import { generateAndPersistDossier, persistTranscript } from "@/lib/dossier-store";
import { transcriptTurnSchema } from "@/lib/divergence";
import { createStudentDossierToken } from "@/lib/student-dossier-token";

const inputSchema = z.object({ transcript: z.array(transcriptTurnSchema).min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    z.string().uuid().parse(id);
    const input = inputSchema.parse(await request.json());
    await persistTranscript(id, input.transcript);
    await completeVivaSession(id);
    const dossier = await generateAndPersistDossier(id);
    const studentToken = createStudentDossierToken(dossier.id);
    return NextResponse.json({
      complete: true,
      dossierId: dossier.id,
      studentDossierPath: `/student-dossier/${studentToken}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not complete viva session." }, { status: 422 });
  }
}
