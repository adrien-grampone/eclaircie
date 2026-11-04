"use client";

import { useRef, useState, type DragEvent } from "react";
import { ILLUSTRATION_ASPECT, ILLUSTRATION_MAX_SIZE, fitImage } from "@pipeline/illustration.ts";

type Target = { kind: "story"; storyId: string } | { kind: "fallback"; themeId: string };

interface Props {
  target: Target;
  /** Action serveur recevant FormData { file, story_id | theme_id }. */
  upload: (form: FormData) => Promise<{ ok: true; path: string }>;
  label?: string;
}

/** Charge un fichier image dans un bitmap, sans dépendance. */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} n'est pas une image`);
  return await createImageBitmap(file);
}

/** Recadrage centré 3:4, réduction sous 1290×1720 (largeur d'un écran iPhone à 3×, rien de plus à décoder), conversion WebP : tout se passe dans le navigateur. */
async function toWebp(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await loadBitmap(file);
  const fit = fitImage({ width: bitmap.width, height: bitmap.height }, ILLUSTRATION_ASPECT, ILLUSTRATION_MAX_SIZE);
  const canvas = document.createElement("canvas");
  canvas.width = fit.output.width;
  canvas.height = fit.output.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponible");
  ctx.drawImage(bitmap, fit.crop.x, fit.crop.y, fit.crop.width, fit.crop.height, 0, 0, fit.output.width, fit.output.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
  if (!blob || blob.type !== "image/webp") throw new Error("ce navigateur ne sait pas écrire du WebP");
  return { blob, width: fit.output.width, height: fit.output.height };
}

export function ImageDrop({ target, upload, label = "Glisse l'image ici ou clique pour choisir" }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ status: "idle" | "busy" | "done" | "error"; message: string }>({ status: "idle", message: "" });
  const [preview, setPreview] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setState({ status: "busy", message: "Recadrage et conversion…" });
    try {
      const { blob, width, height } = await toWebp(file);
      setPreview(URL.createObjectURL(blob));
      setState({ status: "busy", message: `Envoi ${width}×${height}, ${Math.round(blob.size / 1024)} Ko…` });
      const form = new FormData();
      form.set("file", new File([blob], "image.webp", { type: "image/webp" }));
      if (target.kind === "story") form.set("story_id", target.storyId);
      else form.set("theme_id", target.themeId);
      const result = await upload(form);
      setState({ status: "done", message: `Enregistrée : ${result.path}` });
    } catch (cause) {
      setState({ status: "error", message: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void handle(event.dataTransfer.files[0]);
  }

  return (
    <div className={`drop drop-${state.status}`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}
      onClick={() => input.current?.click()} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void handle(e.target.files?.[0])} />
      {preview ? <img src={preview} alt="" className="drop-preview" /> : null}
      <p>{state.message || label}</p>
    </div>
  );
}
