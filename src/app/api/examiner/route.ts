import { NextResponse } from "next/server";
import { examineAnswer, examinerInputSchema } from "@/lib/examiner";

export async function POST(request: Request) {
  try {
    const input = examinerInputSchema.parse(await request.json());
    return NextResponse.json(await examineAnswer(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Examiner request failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
