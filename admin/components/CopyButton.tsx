"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copier le prompt" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  }
  return (
    <button type="button" className="btn" onClick={copy}>
      {state === "done" ? "Copié ✓" : state === "error" ? "Échec de la copie" : label}
    </button>
  );
}
