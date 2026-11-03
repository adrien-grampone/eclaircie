/**
 * extract — §4.3. Prend batch_size articles `triaged`, télécharge la page, extrait
 * le texte principal (Readability). Sous extract_min_chars ou paywall :
 * `failed` / `no_fulltext`. Page injoignable : `failed` / `fetch_error`.
 * On ne résume jamais à partir d'un simple extrait RSS.
 */
import { loadConfig, recordRun, serviceClient } from "../_shared/db.ts";
import { errorMessage, fetchText, json, mapLimit } from "../_shared/http.ts";
import { classifyExtraction, extractMainText } from "../_shared/pipeline/extract.ts";

interface ArticleRow {
  id: string;
  url: string;
}

interface ItemResult {
  id: string;
  url: string;
  outcome: "extracted" | "failed";
  reason: string | null;
  chars: number;
}

const STEP = "extract";
const PAGE_TIMEOUT_MS = 20_000;
const PAGE_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5";

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const { data, error } = await db
      .from("raw_articles")
      .select("id, url")
      .eq("status", "triaged")
      .order("fetched_at", { ascending: true })
      .limit(config.batch_size);
    if (error) throw new Error(`raw_articles : ${error.message}`);
    const articles = (data ?? []) as ArticleRow[];

    const results = await mapLimit(articles, 5, async (article): Promise<ItemResult> => {
      try {
        const html = await fetchText(article.url, PAGE_TIMEOUT_MS, PAGE_ACCEPT);
        const outcome = classifyExtraction(extractMainText(html, article.url), config);
        if (!outcome.ok) {
          await db.from("raw_articles").update({ status: "failed", reject_reason: outcome.reason }).eq("id", article.id);
          return { id: article.id, url: article.url, outcome: "failed", reason: outcome.reason, chars: 0 };
        }
        await db.from("raw_articles").update({ status: "extracted", full_text: outcome.text }).eq("id", article.id);
        return { id: article.id, url: article.url, outcome: "extracted", reason: null, chars: outcome.text.length };
      } catch (cause) {
        const message = errorMessage(cause);
        await db.from("raw_articles").update({ status: "failed", reject_reason: `fetch_error: ${message}` }).eq("id", article.id);
        return { id: article.id, url: article.url, outcome: "failed", reason: `fetch_error: ${message}`, chars: 0 };
      }
    });

    const failed = results.filter((r) => r.outcome === "failed").length;
    await recordRun(db, {
      step: STEP,
      startedAt,
      processed: results.length,
      succeeded: results.length - failed,
      failed,
      error: null,
    });
    return json({ step: STEP, processed: results.length, extracted: results.length - failed, failed, results });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: STEP, startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: STEP, error: message }, 500);
  }
});
