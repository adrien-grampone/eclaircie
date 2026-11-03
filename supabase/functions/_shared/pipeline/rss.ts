import { DOMParser } from "linkedom";

/** Un élément de flux normalisé, prêt pour `raw_articles`. */
export interface FeedItem {
  title: string;
  url: string;
  snippet: string | null;
  /** ISO 8601 ou null si la date est absente ou illisible. */
  publishedAt: string | null;
}

type Node = { localName?: string; children?: Iterable<Node>; textContent?: string | null; getAttribute?: (n: string) => string | null };

function childrenNamed(el: Node, names: readonly string[]): Node[] {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const out: Node[] = [];
  for (const child of el.children ?? []) {
    // linkedom conserve parfois le préfixe (« rdf:RDF », « dc:date ») : on compare sans lui.
    const name = (child.localName ?? "").toLowerCase().replace(/^[^:]+:/, "");
    if (wanted.has(name)) out.push(child);
  }
  return out;
}

function childText(el: Node, names: readonly string[]): string | null {
  const text = childrenNamed(el, names)[0]?.textContent?.trim();
  return text ? text : null;
}

/** Retire les balises HTML d'un extrait et réduit les blancs. */
export function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function toIso(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function snippetOf(raw: string | null, maxChars: number): string | null {
  if (!raw) return null;
  const text = stripHtml(raw);
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function atomLink(entry: Node): string | null {
  const links = childrenNamed(entry, ["link"]);
  const alternate = links.find((l) => (l.getAttribute?.("rel") ?? "alternate") === "alternate");
  return (alternate ?? links[0])?.getAttribute?.("href")?.trim() ?? null;
}

/**
 * Parse un flux RSS 2.0, Atom ou RSS 1.0 (RDF). Les éléments sans titre ou sans
 * lien sont ignorés. Pur : aucun accès réseau.
 */
export function parseFeed(xml: string, snippetMaxChars = 500): FeedItem[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as Node;
  const root = childrenNamed(doc, ["rss", "feed", "rdf"])[0];
  if (!root) return [];

  const items: FeedItem[] = [];
  const push = (title: string | null, url: string | null, snippet: string | null, date: string | null) => {
    if (!title || !url) return;
    items.push({ title: stripHtml(title), url, snippet: snippetOf(snippet, snippetMaxChars), publishedAt: toIso(date) });
  };

  if (root.localName === "feed") {
    for (const entry of childrenNamed(root, ["entry"])) {
      push(childText(entry, ["title"]), atomLink(entry), childText(entry, ["summary", "content"]), childText(entry, ["published", "updated"]));
    }
    return items;
  }

  const container = root.localName === "rss" ? childrenNamed(root, ["channel"])[0] : root;
  if (!container) return [];
  for (const item of childrenNamed(container, ["item"])) {
    push(childText(item, ["title"]), childText(item, ["link"]), childText(item, ["description", "encoded"]), childText(item, ["pubDate", "date", "published"]));
  }
  return items;
}
