import { listDossierTriage } from "@/lib/dossier-store";
import TriageTable from "@/app/triage/triage-table";

export const dynamic = "force-dynamic";

export default async function TriagePage() {
  const rows = await listDossierTriage();
  return <main className="triage-page">
    <header className="triage-header"><a href="/" className="wordmark">ELEZA</a><span>COMPLETED PUBLIC DEMO VIVAS</span></header>
    <p className="triage-guidance">Start with the dossiers that have findings. The evidence is inside.</p>
    <TriageTable initialRows={rows} />
  </main>;
}
