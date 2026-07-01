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
