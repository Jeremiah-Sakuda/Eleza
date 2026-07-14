"use client";

export function PrintDossierButton() {
  return <button className="print-dossier-button" type="button" onClick={() => window.print()}>
    Print dossier
  </button>;
}
