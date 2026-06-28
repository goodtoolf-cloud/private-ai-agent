"""
FILE: backend/routers/search.py
Web search and research endpoints.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from services.searxng import search_web, fetch_page_content, research_topic
from services.cloudflare import chat_complete

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    num_results: int = 10
    deep_research: bool = False


class FetchRequest(BaseModel):
    url: str


@router.post("/")
async def search(req: SearchRequest):
    """Search the web via SearXNG."""
    results = await search_web(req.query, req.num_results)
    return {"query": req.query, "results": results, "count": len(results)}


@router.post("/fetch")
async def fetch(req: FetchRequest):
    """Fetch and extract text content from a URL."""
    content = await fetch_page_content(req.url)
    return {"url": req.url, "content": content, "length": len(content)}


@router.post("/research")
async def research(req: SearchRequest):
    """
    Deep research: search multiple sources, fetch full content,
    then synthesize a comprehensive AI-generated report.
    """
    research_data = await research_topic(req.query, num_sources=req.num_results)

    sources_text = ""
    for i, src in enumerate(research_data["sources"], 1):
        sources_text += f"\n\n--- Source {i}: {src['title']} ({src['url']}) ---\n"
        sources_text += src["full_content"][:2000]

    prompt = f"""You are conducting deep research on the following topic: "{req.query}"

I have gathered content from {research_data['source_count']} web sources:{sources_text}

Please:
1. Synthesize the information from all sources
2. Identify key findings and patterns
3. Note any conflicting information between sources
4. Provide a comprehensive, well-structured research report
5. List all sources used at the end
6. At the very end, add your confidence assessment: [Confidence: XX% | Sources: {research_data['source_count']}]
"""

    result = await chat_complete(
        messages=[{"role": "user", "content": prompt}],
        model_key="deepseek",
    )

    return {
        "query": req.query,
        "report": result["text"],
        "sources": [{"title": s["title"], "url": s["url"]} for s in research_data["sources"]],
        "source_count": research_data["source_count"],
        "model_used": "deepseek",
    }
