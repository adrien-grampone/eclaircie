// Test de cohérence des illustrations : 5 prompts × N modèles, un appel par image.
// Usage : GEMINI_API_KEY=… node generate.mjs <model> <outDir> [budgetUsd]
// Écrit <outDir>/<slug>.png et <outDir>/<slug>.json (usage et coût), s'arrête si le budget est dépassé.
import { readFile, writeFile } from "node:fs/promises";

const PRICES = {
  // USD par million de tokens, page pricing du 2026-11-03
  "gemini-3-pro-image": { input: 2, outputText: 12, outputImage: 120 },
  "gemini-nano-banana-2.1": { input: 1.5, outputText: 7.5, outputImage: 30 },
};

const [model, outDir, budgetArg] = process.argv.slice(2);
const budget = Number(budgetArg ?? "1");
const key = process.env.GEMINI_API_KEY;
if (!model || !outDir || !key || !PRICES[model]) {
  console.error("usage: GEMINI_API_KEY=… node generate.mjs <model> <outDir> [budgetUsd]");
  process.exit(1);
}

function costUsd(usage) {
  const p = PRICES[model];
  const byModality = (list, modality) => (list ?? []).filter((d) => d.modality === modality).reduce((s, d) => s + d.tokenCount, 0);
  const input = usage.promptTokenCount ?? 0;
  const imageOut = byModality(usage.candidatesTokensDetails, "IMAGE");
  const textOut = (usage.candidatesTokenCount ?? 0) - imageOut + (usage.thoughtsTokenCount ?? 0);
  return (input * p.input + textOut * p.outputText + imageOut * p.outputImage) / 1e6;
}

const prompts = JSON.parse(await readFile(new URL("./prompts.json", import.meta.url), "utf8"));
let spent = 0;
for (const { slug, prompt } of prompts) {
  if (spent >= budget) { console.error(`budget ${budget} $ atteint, arrêt`); break; }
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4", imageSize: "2K" } },
    }),
  });
  const body = await res.json();
  if (!res.ok) { console.error(slug, res.status, JSON.stringify(body).slice(0, 400)); continue; }
  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((p) => p.inlineData);
  const usage = body.usageMetadata ?? {};
  const cost = costUsd(usage);
  spent += cost;
  const meta = { model, slug, ms: Date.now() - started, usage, cost_usd: cost, mime: image?.inlineData?.mimeType ?? null };
  await writeFile(`${outDir}/${slug}.json`, JSON.stringify(meta, null, 2));
  if (!image) { console.error(slug, "pas d'image", JSON.stringify(body).slice(0, 400)); continue; }
  const ext = meta.mime === "image/jpeg" ? "jpg" : "png";
  await writeFile(`${outDir}/${slug}.${ext}`, Buffer.from(image.inlineData.data, "base64"));
  console.log(`${slug}: ${ext}, ${(meta.ms / 1000).toFixed(1)} s, ${cost.toFixed(4)} $ (cumul ${spent.toFixed(4)} $)`);
}
console.log(`total ${model}: ${spent.toFixed(4)} $`);
