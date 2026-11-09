/**
 * collect — §4.1. Lit TOUS les flux actifs (aucun appel à un modèle, donc pas de lot),
 * les moins récemment lus d'abord,
 * insère les articles de moins de collect_max_age_days dans raw_articles
 * (url unique, doublons ignorés). Aucun appel à un modèle.
 */
import { loadConfig, recordRun, serviceClient } from "../_shared/db.ts";
import { errorMessage, fetchText, json, mapLimit } from "../_shared/http.ts";
import { collectMaxAgeDays, isFreshEnough, sourceIsFollowed } from "../_shared/pipeline/collect.ts";
import { parseFeed } from "../_shared/pipeline/rss.ts";

interface SourceRow {
  id: string;
  name: string;
  feed_url: string;
  trust_level: number;
  /** Thèmes que la source alimente (null = non renseigné : toujours collectée). */
  themes: string[] | null;
}

interface SourceReport {
  source: string;
  fetched: number;
  inserted: number;
  error: string | null;
}

const FEED_TIMEOUT_MS = 15_000;
const FEED_ACCEPT = "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5";

Deno.serve(async () => {
  const startedAt = new Date().toISOString();
  const db = serviceClient();
  try {
    const config = await loadConfig(db);
    const { data, error } = await db
      .from("sources")
      .select("id, name, feed_url, trust_level, themes")
      .eq("active", true)
      .order("last_fetched_at", { ascending: true, nullsFirst: true });
    if (error) throw new Error(`sources : ${error.message}`);
    const sources = ((data ?? []) as SourceRow[]).filter((s) => sourceIsFollowed(s.themes, config.followed_themes));
    const now = new Date();

    const reports = await mapLimit(sources, 5, async (source): Promise<SourceReport> => {
      const fetchedAt = new Date().toISOString();
      try {
        const xml = await fetchText(source.feed_url, FEED_TIMEOUT_MS, FEED_ACCEPT);
        const maxAgeDays = collectMaxAgeDays(source.trust_level, config);
        const items = parseFeed(xml).filter((item) => isFreshEnough(item.publishedAt, maxAgeDays, now));
        const rows = items.map((item) => ({
          source_id: source.id,
          url: item.url,
          title: item.title,
          snippet: item.snippet,
          published_at: item.publishedAt,
        }));
        let inserted = 0;
        if (rows.length > 0) {
          const { data: insertedRows, error: insertError } = await db
            .from("raw_articles")
            .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
            .select("id");
          if (insertError) throw new Error(`raw_articles : ${insertError.message}`);
          inserted = insertedRows?.length ?? 0;
        }
        await db.from("sources").update({ last_fetched_at: fetchedAt, last_error: null }).eq("id", source.id);
        return { source: source.name, fetched: items.length, inserted, error: null };
      } catch (cause) {
        const message = errorMessage(cause);
        await db.from("sources").update({ last_fetched_at: fetchedAt, last_error: message }).eq("id", source.id);
        return { source: source.name, fetched: 0, inserted: 0, error: message };
      }
    });

    const failed = reports.filter((r) => r.error !== null).length;
    await recordRun(db, {
      step: "collect",
      startedAt,
      processed: reports.length,
      succeeded: reports.length - failed,
      failed,
      error: null,
    });
    return json({ step: "collect", sources: reports.length, inserted: reports.reduce((n, r) => n + r.inserted, 0), reports });
  } catch (cause) {
    const message = errorMessage(cause);
    await recordRun(db, { step: "collect", startedAt, processed: 0, succeeded: 0, failed: 0, error: message });
    return json({ step: "collect", error: message }, 500);
  }
});
