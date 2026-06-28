"""
FILE: backend/services/searxng.py
Web search via self-hosted SearXNG instance.
"""

import httpx
from bs4 import BeautifulSoup
from config import get_settings

settings = get_settings()


async def search_web(query: str, num_results: int = 10) -> list[dict]:
    """Search the web via SearXNG."""
    params = {
        "q": query,
        "format": "json",
        "engines": "google,bing,duckduckgo",
        "language": "en",
        "pageno": 1,
        "safesearch": 0,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{settings.searxng_url}/search",
                params=params,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            return [{"error": str(e), "title": "Search failed", "url": "", "content": ""}]

    results = []
    for r in data.get("results", [])[:num_results]:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
            "engine": r.get("engine", ""),
            "score": r.get("score", 0),
        })

    return results


async def fetch_page_content(url: str) -> str:
    """Fetch and extract readable text from a webpage."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }

    async with httpx.AsyncClient(
        timeout=30.0,
        follow_redirects=True,
        headers=headers,
    ) as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text
        except Exception as e:
            return f"Could not fetch {url}: {str(e)}"

    soup = BeautifulSoup(html, "html.parser")

    # Remove script, style, nav, footer elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        tag.decompose()

    # Get main text
    text = soup.get_text(separator="\n", strip=True)

    # Collapse excessive newlines
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    text = "\n".join(lines)

    # Limit length
    return text[:8000]


async def research_topic(query: str, num_sources: int = 5) -> dict:
    """Full research: search + fetch content from top results."""
    search_results = await search_web(query, num_results=num_sources)

    sources = []
    for result in search_results:
        if result.get("url"):
            content = await fetch_page_content(result["url"])
            sources.append({
                "title": result["title"],
                "url": result["url"],
                "snippet": result["content"],
                "full_content": content[:3000],
            })

    return {
        "query": query,
        "sources": sources,
        "source_count": len(sources),
    }
