"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fallbackPrefix, illustrationPath, imageAlertFingerprint } from "@pipeline/illustration.ts";
import { requireAdmin } from "./auth.ts";
import { isAllowedEmail } from "./env.ts";
import { adminClient, sessionClient } from "./supabase.ts";

const PAGES = ["/images", "/review", "/approved", "/stock", "/reports", "/health"];

function refresh(): void {
  for (const page of PAGES) revalidatePath(page);
}

function text(form: FormData, name: string, { required = true, max = 5000 } = {}): string {
  const value = form.get(name);
  const str = typeof value === "string" ? value.trim() : "";
  if (required && str === "") throw new Error(`Champ ${name} requis`);
  if (str.length > max) throw new Error(`Champ ${name} trop long`);
  return str;
}

function check(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context} : ${error.message}`);
}

export async function signIn(form: FormData): Promise<void> {
  const email = text(form, "email", { max: 200 }).toLowerCase();
  if (!isAllowedEmail(email)) redirect("/login?refused=1");
  const origin = text(form, "origin", { max: 200 });
  const supabase = await sessionClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  check("envoi du lien", error);
  redirect("/login?sent=1");
}

export async function signOut(): Promise<void> {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Validation du texte : la story reste à son statut, approved_at la sort de la file « À valider ». */
export async function approveStory(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id", { max: 64 });
  const { error } = await adminClient().from("stories").update({ approved_at: new Date().toISOString() }).eq("id", id);
  check("validation", error);
  refresh();
}

/** Annulation de la validation : la story revient dans « À valider » (et disparaît de l'app si elle était publiée). */
export async function unapproveStory(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id", { max: 64 });
  const { error } = await adminClient().from("stories").update({ approved_at: null }).eq("id", id);
  check("annulation de la validation", error);
  refresh();
}

/** Rejet : libère le jour programmé (schedule le remplira à 4 h) et garde la raison. */
export async function rejectStory(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id", { max: 64 });
  const reason = text(form, "reason", { max: 500 });
  const db = adminClient();
  const { error } = await db.from("stories")
    .update({ status: "rejected", reject_reason: `backoffice: ${reason}`, publish_date: null }).eq("id", id);
  check("rejet", error);
  await db.rpc("resolve_pipeline_alert", { p_fingerprint: imageAlertFingerprint(id) });
  refresh();
}

/** Retrait après publication (§6) : la nouvelle disparaît de l'app, le jour reste occupé par la mention « retirée ». */
export async function retractStory(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id", { max: 64 });
  const { error } = await adminClient().from("stories")
    .update({ status: "retracted", reject_reason: `backoffice: ${text(form, "reason", { required: false, max: 500 }) || "retirée après vérification"}` })
    .eq("id", id);
  check("retrait", error);
  refresh();
}

/** Édition du texte par l'humain : titre, chute, résumé, scène. Les claims restent ceux vérifiés. */
export async function editStory(form: FormData): Promise<void> {
  await requireAdmin();
  const id = text(form, "id", { max: 64 });
  const { error } = await adminClient().from("stories").update({
    title_main: text(form, "title_main", { max: 200 }),
    title_accent: text(form, "title_accent", { required: false, max: 200 }) || null,
    summary: text(form, "summary", { max: 1000 }),
    scene: text(form, "scene", { max: 2000 }),
  }).eq("id", id);
  check("édition", error);
  refresh();
}

async function uploadWebp(path: string, file: File): Promise<void> {
  if (file.type !== "image/webp") throw new Error(`format ${file.type} refusé : WebP attendu`);
  if (file.size === 0) throw new Error("fichier vide");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await adminClient().storage.from("illustrations").upload(path, bytes, { contentType: "image/webp", upsert: true });
  check(`dépôt ${path}`, error);
}

/** Dépôt de l'illustration d'une story (déjà recadrée 3:4 et convertie en WebP par le navigateur). */
export async function uploadIllustration(form: FormData): Promise<{ ok: true; path: string }> {
  await requireAdmin();
  const id = text(form, "story_id", { max: 64 });
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("fichier manquant");
  const path = illustrationPath(id);
  await uploadWebp(path, file);
  const db = adminClient();
  const { error } = await db.from("stories").update({ image_path: path }).eq("id", id);
  check("image_path", error);
  await db.rpc("resolve_pipeline_alert", { p_fingerprint: imageAlertFingerprint(id) });
  refresh();
  return { ok: true, path };
}

/** Dépôt d'une image de secours pour un thème : fallback/<theme_id>/<horodatage>.webp. */
export async function uploadFallback(form: FormData): Promise<{ ok: true; path: string }> {
  await requireAdmin();
  const themeId = text(form, "theme_id", { max: 64 });
  if (!/^[a-z0-9-]+$/.test(themeId)) throw new Error("thème invalide");
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("fichier manquant");
  const path = `${fallbackPrefix(themeId)}${Date.now()}.webp`;
  await uploadWebp(path, file);
  refresh();
  return { ok: true, path };
}

export async function removeFallback(form: FormData): Promise<void> {
  await requireAdmin();
  const path = text(form, "path", { max: 300 });
  if (!path.startsWith("fallback/")) throw new Error("chemin invalide");
  const { error } = await adminClient().storage.from("illustrations").remove([path]);
  check("suppression", error);
  refresh();
}

export async function resolveAlert(form: FormData): Promise<void> {
  await requireAdmin();
  const { error } = await adminClient().rpc("resolve_pipeline_alert", { p_fingerprint: text(form, "fingerprint", { max: 300 }) });
  check("résolution", error);
  refresh();
}
