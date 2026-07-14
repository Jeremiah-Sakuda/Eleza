import pdf from "pdf-parse/lib/pdf-parse.js";

const MAX_TEXT_LENGTH = 60_000;

export async function extractSubmissionText(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") return (await file.text()).trim();
  if (extension === "pdf") {
    const parsed = await pdf(Buffer.from(await file.arrayBuffer()));
    return parsed.text.trim();
  }
  throw new Error("Upload a .txt or .pdf file.");
}

export function assertUsableText(text: string) {
  if (text.length < 200) throw new Error("The submission needs at least 200 characters of extractable text.");
  if (text.length > MAX_TEXT_LENGTH) throw new Error("The submission is too long for this demo (60,000 character limit).");
}
