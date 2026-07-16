import { NextResponse } from "next/server";
import { answerMetaViva, metaVivaInputSchema } from "@/lib/meta-viva";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const input = metaVivaInputSchema.parse(await request.json());
    return NextResponse.json(await answerMetaViva(input), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "This routing decision could not be examined." }, { status: 422 });
  }
}
