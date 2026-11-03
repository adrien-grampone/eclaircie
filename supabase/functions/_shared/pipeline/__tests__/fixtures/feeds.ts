/** Flux de fixture : RSS 2.0 à la française, Atom, RSS 1.0 (RDF). */

export const RSS2 = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Le Quotidien Vert — Planète</title>
  <link>https://example.org/planete</link>
  <item>
    <title><![CDATA[Au Sénégal, 80 millions de mangroves replantées]]></title>
    <link>https://example.org/planete/mangroves</link>
    <description><![CDATA[<p>Dans le delta du Saloum, les palétuviers&nbsp;ont repris leurs droits. <a href="x">Lire</a></p>]]></description>
    <pubDate>Thu, 30 Oct 2026 05:30:00 GMT</pubDate>
    <dc:creator>Rédaction</dc:creator>
  </item>
  <item>
    <title>Sans date ni extrait</title>
    <link>https://example.org/planete/sans-date</link>
  </item>
  <item>
    <title>Sans lien, à ignorer</title>
    <description>…</description>
  </item>
  <item>
    <link>https://example.org/planete/sans-titre</link>
  </item>
</channel>
</rss>`;

export const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ESA Space News</title>
  <entry>
    <title>Juice completes Venus flyby</title>
    <link rel="self" href="https://example.org/atom/self"/>
    <link rel="alternate" type="text/html" href="https://example.org/esa/juice-venus"/>
    <summary type="html">&lt;p&gt;ESA&amp;#39;s Juice spacecraft flew past Venus.&lt;/p&gt;</summary>
    <published>2026-10-29T10:00:00Z</published>
    <updated>2026-10-29T12:00:00Z</updated>
  </entry>
  <entry>
    <title>Only href link</title>
    <link href="https://example.org/esa/only-href"/>
    <content type="text">Plain text content here.</content>
    <updated>2026-10-28T08:00:00+02:00</updated>
  </entry>
</feed>`;

export const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://example.org/nature"><title>Nature</title></channel>
  <item rdf:about="https://example.org/nature/ozone">
    <title>Ozone layer on track to recover</title>
    <link>https://example.org/nature/ozone</link>
    <description>The latest assessment confirms the trend.</description>
    <dc:date>2026-10-27T09:00:00Z</dc:date>
  </item>
</rdf:RDF>`;

const PARAGRAPH =
  "Le rapport quadriennal publié ce lundi par le Programme des Nations unies pour l’environnement confirme une tendance qui se dessine depuis une décennie : la couche d’ozone se reconstitue, et les auteurs attendent un retour au niveau de 1980 vers 2066 au-dessus de l’Antarctique. ";

export const ARTICLE_HTML = `<!doctype html><html lang="fr"><head><title>La couche d’ozone se répare | Le Quotidien Vert</title></head>
<body>
<header><nav><a href="/">Accueil</a><a href="/planete">Planète</a></nav></header>
<main>
<article>
<h1>La couche d’ozone se répare</h1>
<p class="chapo">Le rapport de l’ONU confirme la reprise.</p>
${Array.from({ length: 8 }, () => `<p>${PARAGRAPH}</p>`).join("\n")}
</article>
<aside><h3>À lire aussi</h3><ul><li><a href="/a">Un autre article</a></li></ul></aside>
</main>
<footer><p>© Le Quotidien Vert — Mentions légales — Cookies</p></footer>
</body></html>`;

export const PAYWALL_HTML = `<!doctype html><html lang="fr"><head><title>Article réservé</title></head>
<body><main><article><h1>Un vaccin déployé dans douze pays</h1>
<p>Les premières doses ont été livrées…</p>
<div class="paywall"><p>Cet article est réservé aux abonnés. Connectez-vous ou abonnez-vous pour lire la suite.</p></div>
</article></main></body></html>`;
