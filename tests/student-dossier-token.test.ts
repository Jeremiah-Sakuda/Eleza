import assert from "node:assert/strict";
import test from "node:test";
import { createStudentDossierToken, readStudentDossierToken } from "../src/lib/student-dossier-token";

const dossierId = "07cdb6bf-865f-4f4c-a6c9-862c70214d64";
const secret = "test-only-signing-secret";

test("student dossier tokens round-trip without storing a bearer credential", () => {
  const token = createStudentDossierToken(dossierId, secret);
  assert.equal(readStudentDossierToken(token, secret), dossierId);
  assert.equal(readStudentDossierToken(`${token.slice(0, -1)}x`, secret), null);
  assert.equal(readStudentDossierToken(token, "different-secret"), null);
});

test("student dossier tokens reject malformed and non-UUID payloads", () => {
  assert.equal(readStudentDossierToken("not-a-token", secret), null);
  const token = createStudentDossierToken(dossierId, secret);
  assert.equal(readStudentDossierToken(`${token}.extra`, secret), null);
});
