import { notFound } from "next/navigation";
import { DossierView } from "@/app/dossier/dossier-view";
import { loadDossier, type Dossier } from "@/lib/dossier-store";

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let dossier: Dossier;
  try {
    dossier = await loadDossier(id);
  } catch {
    notFound();
  }
  return <DossierView dossier={dossier} />;
}
