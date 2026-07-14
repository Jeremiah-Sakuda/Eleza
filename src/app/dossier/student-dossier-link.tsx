"use client";

import { useEffect, useState } from "react";

export function StudentDossierLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const [absoluteUrl, setAbsoluteUrl] = useState(path);

  useEffect(() => setAbsoluteUrl(`${window.location.origin}${path}`), [path]);

  async function copyLink() {
    await navigator.clipboard.writeText(absoluteUrl);
    setCopied(true);
  }

  return <section className="student-dossier-access" aria-label="Student dossier link">
    <p>This is your copy of the evidence. Your teacher sees exactly the same document.</p>
    <div>
      <input aria-label="Student dossier URL" readOnly value={absoluteUrl} onFocus={(event) => event.currentTarget.select()} />
      <button type="button" onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button>
    </div>
  </section>;
}
