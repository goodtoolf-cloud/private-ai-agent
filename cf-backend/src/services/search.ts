// FILE: cf-backend/src/services/search.ts
// Web search via DuckDuckGo + page content fetching

import { Env, SearchResult } from "../types";

export async function searchWeb(
  env: Env,
  query: string,
  numResults = 10
): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);
    const html = await res.text();

    const results: SearchResult[] = [];
    const regex = /class="result__title"[^>]*>.*?href="([^"]+)"[^>]*>(.*?)<\/a>.*?class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    let match;
    while ((match = regex.exec(html)) !== null && results.length < numResults) {
      const rawUrl = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const content = match[3].replace(/<[^>]+>/g, "").trim();
      if (rawUrl && title) {
        const actualUrl = rawUrl.includes("uddg=")
          ? decodeURIComponent(rawUrl.split("uddg=")[1].split("&")[0])
          : rawUrl;
        results.push({ title, url: actualUrl, content, engine: "duckduckgo" });
      }
    }
    return results.length > 0 ? results : [{ title: "No results", url: "", content: "No results found", engine: "duckduckgo" }];
  } catch (e) {
    return [{ title: "Search failed", url: "", content: String(e), engine: "" }];
  }
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,*/*",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return `Could not fetch ${url}: HTTP ${res.status}`;
    const html = await res.text();
    return extractTextFromHtml(html).slice(0, 6000);
  } catch (e) {
    return `Could not fetch ${url}: ${String(e)}`;
  }
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function researchTopic(
  env: Env,
  query: string,
  numSources = 5
): Promise<{ sources: Array<{ title: string; url: string; content: string }> }> {
  const results = await searchWeb(env, query, numSources);

  const sources = await Promise.all(
    results
      .filter((r) => r.url)
      .map(async (r) => {
        const content = await fetchPageContent(r.url);
        return { title: r.title, url: r.url, content: content.slice(0, 3000) };
      })
  );

  return { sources };
}
