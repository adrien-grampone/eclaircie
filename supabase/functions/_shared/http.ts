const USER_AGENT = "Mozilla/5.0 (compatible; EclaircieBot/0.1; +https://eclaircie.app)";

/** GET avec délai maximal ; lance sur statut non 2xx. */
export async function fetchText(url: string, timeoutMs: number, accept: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept, "accept-language": "fr,en;q=0.8" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.name === "AbortError" ? "timeout" : cause.message;
  return String(cause);
}

/** Exécute `worker` sur chaque élément avec au plus `limit` tâches en parallèle. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T);
    }
  });
  await Promise.all(lanes);
  return results;
}
