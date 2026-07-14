import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const UUID = z.string().uuid();

function signingSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for student dossier links.");
  return secret;
}

function signature(encodedId: string, secret: string) {
  return createHmac("sha256", secret).update(`eleza-student-dossier-v1:${encodedId}`).digest();
}

export function createStudentDossierToken(dossierId: string, secret = signingSecret()) {
  const id = UUID.parse(dossierId);
  const encodedId = Buffer.from(id, "utf8").toString("base64url");
  // DECISION: sign the existing dossier ID instead of persisting a second access record; the evidence stays canonical and the URL remains unguessable.
  return `${encodedId}.${signature(encodedId, secret).toString("base64url")}`;
}

export function readStudentDossierToken(token: string, secret = signingSecret()) {
  const [encodedId, encodedSignature, extra] = token.split(".");
  if (!encodedId || !encodedSignature || extra) return null;
  try {
    const received = Buffer.from(encodedSignature, "base64url");
    const expected = signature(encodedId, secret);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    return UUID.parse(Buffer.from(encodedId, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
