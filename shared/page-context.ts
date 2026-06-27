import type { PageType } from "./types/scan";

function parseStructuredDataType(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const graph = record["@graph"];
      if (Array.isArray(graph)) {
        for (const node of graph) {
          if (node && typeof node === "object") {
            const type = (node as Record<string, unknown>)["@type"];
            if (typeof type === "string") return type;
          }
        }
      }
      const type = record["@type"];
      if (typeof type === "string") return type;
    }
  } catch {
    return null;
  }

  return null;
}

export function detectPageType(doc: Document): PageType {
  const ogType = doc
    .querySelector('meta[property="og:type"]')
    ?.getAttribute("content")
    ?.toLowerCase();

  if (ogType === "article" || ogType === "newsarticle") {
    return "editorial";
  }

  for (const script of doc.querySelectorAll(
    'script[type="application/ld+json"]',
  )) {
    const structuredType = parseStructuredDataType(script.textContent ?? "");
    if (
      structuredType === "NewsArticle" ||
      structuredType === "Article" ||
      structuredType === "BlogPosting"
    ) {
      return "editorial";
    }
  }

  const article = doc.querySelector("article");
  if (article) {
    const articleLength = (article.textContent ?? "").trim().length;
    const bodyLength = (doc.body?.textContent ?? "").trim().length;
    if (articleLength > 400 && articleLength / Math.max(bodyLength, 1) > 0.35) {
      return "editorial";
    }
  }

  return "general";
}
