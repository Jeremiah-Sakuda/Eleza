import { notFound } from "next/navigation";
import { DossierView } from "@/app/dossier/dossier-view";
import { loadDossier, type Dossier } from "@/lib/dossier-store";
import { readStudentDossierToken } from "@/lib/student-dossier-token";

export const dynamic = "force-dynamic";

export default async function StudentDossierPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dossierId = readStudentDossierToken(token);
  if (!dossierId) notFound();
  let dossier: Dossier;
  try {
    dossier = await loadDossier(dossierId);
  } catch {
    notFound();
  }
  return <DossierView dossier={dossier} studentPath={`/student-dossier/${token}`} />;
}
