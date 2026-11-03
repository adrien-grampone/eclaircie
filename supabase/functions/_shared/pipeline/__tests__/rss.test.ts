import { parseFeed, stripHtml } from "../rss.ts";
import { ATOM, RDF, RSS2 } from "./fixtures/feeds.ts";

describe("parseFeed — RSS 2.0", () => {
  const items = parseFeed(RSS2);

  it("garde les items avec titre et lien, ignore les autres", () => {
    expect(items.map((i) => i.url)).toEqual([
      "https://example.org/planete/mangroves",
      "https://example.org/planete/sans-date",
    ]);
  });

  it("nettoie le titre CDATA et l'extrait HTML", () => {
    expect(items[0]?.title).toBe("Au Sénégal, 80 millions de mangroves replantées");
    expect(items[0]?.snippet).toBe("Dans le delta du Saloum, les palétuviers ont repris leurs droits. Lire");
  });

  it("convertit pubDate en ISO et tolère l'absence de date ou d'extrait", () => {
    expect(items[0]?.publishedAt).toBe("2026-10-30T05:30:00.000Z");
    expect(items[1]?.publishedAt).toBeNull();
    expect(items[1]?.snippet).toBeNull();
  });

  it("tronque les extraits trop longs", () => {
    const long = RSS2.replace("<description><![CDATA[<p>Dans", `<description><![CDATA[<p>${"mot ".repeat(300)}Dans`);
    const snippet = parseFeed(long, 100)[0]?.snippet ?? "";
    expect(snippet.length).toBe(100);
    expect(snippet.endsWith("…")).toBe(true);
  });
});

describe("parseFeed — Atom", () => {
  const items = parseFeed(ATOM);

  it("prend le lien alternate plutôt que self, ou le seul href", () => {
    expect(items.map((i) => i.url)).toEqual(["https://example.org/esa/juice-venus", "https://example.org/esa/only-href"]);
  });

  it("préfère published à updated, et décode le résumé HTML échappé", () => {
    expect(items[0]?.publishedAt).toBe("2026-10-29T10:00:00.000Z");
    expect(items[0]?.snippet).toBe("ESA's Juice spacecraft flew past Venus.");
    expect(items[1]?.publishedAt).toBe("2026-10-28T06:00:00.000Z");
    expect(items[1]?.snippet).toBe("Plain text content here.");
  });
});

describe("parseFeed — RSS 1.0 / RDF", () => {
  it("lit les items et dc:date", () => {
    const items = parseFeed(RDF);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Ozone layer on track to recover");
    expect(items[0]?.publishedAt).toBe("2026-10-27T09:00:00.000Z");
  });
});

describe("parseFeed — robustesse", () => {
  it("renvoie une liste vide pour du HTML, du vide ou du XML sans racine connue", () => {
    expect(parseFeed("<html><body>Not a feed</body></html>")).toEqual([]);
    expect(parseFeed("")).toEqual([]);
    expect(parseFeed("<opml><body/></opml>")).toEqual([]);
  });
});

describe("stripHtml", () => {
  it("retire balises, CDATA et entités courantes", () => {
    expect(stripHtml("<![CDATA[<b>A &amp; B</b>&nbsp;&quot;c&quot; &#39;d&#39;]]>")).toBe("A & B \"c\" 'd'");
  });
});
