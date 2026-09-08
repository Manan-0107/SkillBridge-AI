"""
CareerForge Python Web Browser & Real-Time Information Retrieval Module
=======================================================================
Allows the AI assistant to browse across the web, search live articles,
extract factual data from Wikipedia & live sites, and cite references.
"""

import urllib.request
import urllib.parse
import json
import re
from typing import Dict, Any, List, Optional
import requests
from bs4 import BeautifulSoup


class WebBrowser:
    def __init__(self):
        self.headers = {
            "User-Agent": (
                "CareerForge-Assistant/2.0 (contact@careerforge.local; bot/educational; MCP-Tools)"
            )
        }

    def search_live_web(self, query: str, max_results: int = 3) -> Dict[str, Any]:
        """
        Searches the live web across encyclopedia, knowledge sources, and websites.
        Returns extracted snippets, titles, and URLs using fast single-request generator.
        """
        clean_query = query.strip()
        results = []

        # 1. Fast Generator Search across Wikipedia Knowledge Base
        try:
            wiki_url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "generator": "search",
                "gsrsearch": clean_query,
                "gsrlimit": max_results,
                "prop": "extracts",
                "exintro": 1,
                "explaintext": 1,
                "format": "json",
            }
            resp = requests.get(wiki_url, params=params, headers=self.headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                pages = data.get("query", {}).get("pages", {})
                for pid, p in sorted(pages.items(), key=lambda item: item[1].get("index", 999)):
                    title = p.get("title", "")
                    extract = p.get("extract", "").strip()
                    if title and extract:
                        results.append({
                            "title": title,
                            "snippet": extract,
                            "source": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}",
                        })
        except Exception as e:
            print(f"[WebBrowser] Wikipedia search error: {e}")

        # 2. If query contains a direct URL, browse and scrape that site
        url_match = re.search(r"https?://[^\s]+", clean_query)
        if url_match:
            scraped = self.fetch_page_content(url_match.group(0))
            if scraped:
                results.insert(0, scraped)

        return {
            "query": clean_query,
            "results": results,
            "summary": self._format_results_summary(results),
        }

    def _get_wiki_extract(self, title: str) -> str:
        """Fetches lead summary paragraph for a specific topic."""
        try:
            wiki_url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "prop": "extracts",
                "exintro": True,
                "explaintext": True,
                "titles": title,
                "format": "json",
            }
            resp = requests.get(wiki_url, params=params, headers=self.headers, timeout=4)
            if resp.status_code == 200:
                pages = resp.json().get("query", {}).get("pages", {})
                for page_id, page_info in pages.items():
                    extract = page_info.get("extract", "")
                    if extract:
                        return extract[:600]
        except Exception:
            pass
        return ""

    def fetch_page_content(self, url: str) -> Optional[Dict[str, str]]:
        """Browses a specific URL, parses HTML, and extracts readable text."""
        try:
            resp = requests.get(url, headers=self.headers, timeout=6)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                # Remove scripts, styles, navs
                for tag in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                    tag.decompose()
                title = soup.title.string.strip() if soup.title and soup.title.string else url
                paragraphs = [p.get_text().strip() for p in soup.find_all("p") if p.get_text().strip()]
                body_text = " ".join(paragraphs[:8])[:1200]
                return {
                    "title": title,
                    "snippet": body_text,
                    "source": url,
                }
        except Exception as e:
            print(f"[WebBrowser] URL fetch error ({url}): {e}")
        return None

    def _format_results_summary(self, results: List[Dict[str, str]]) -> str:
        if not results:
            return "No web browsing data retrieved."
        lines = []
        for i, r in enumerate(results, 1):
            lines.append(f"[{i}] {r['title']} ({r['source']}):\n{r['snippet']}")
        return "\n\n".join(lines)


# Singleton
web_browser = WebBrowser()
