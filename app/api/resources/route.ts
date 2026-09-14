/**
 * GET /api/resources
 *
 * 100% Free Live Tech Articles, Career Guides & Open Source Trends:
 * - Dev.to Public Articles API (Free, No Key)
 * - HackerNews Public Algolia API (Free, No Key)
 * - GitHub Search API (Free, No Key)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface TechResource {
  id: string;
  title: string;
  url: string;
  description: string;
  source: "Dev.to" | "HackerNews" | "GitHub" | "Curated";
  author?: string;
  tags: string[];
  publishedAt: string;
  upvotes?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = (searchParams.get("topic") || "career").toLowerCase().trim();
    const type = (searchParams.get("type") || "all").toLowerCase().trim();

    const [devToResults, hnResults, ghResults] = await Promise.allSettled([
      fetchDevToArticles(topic),
      fetchHackerNewsPosts(topic),
      fetchGitHubTrending(topic),
    ]);

    let resources: TechResource[] = [];

    if (devToResults.status === "fulfilled") {
      resources.push(...devToResults.value);
    }
    if (hnResults.status === "fulfilled") {
      resources.push(...hnResults.value);
    }
    if (ghResults.status === "fulfilled") {
      resources.push(...ghResults.value);
    }

    if (resources.length === 0) {
      resources = getCuratedResources(topic);
    }

    if (type !== "all") {
      resources = resources.filter((r) => r.source.toLowerCase() === type);
    }

    return NextResponse.json({
      status: "success",
      topic,
      total: resources.length,
      resources: resources.slice(0, 24),
    });
  } catch (error) {
    console.error("[Resources API] Error fetching resources:", error);
    return NextResponse.json({
      status: "fallback",
      total: getCuratedResources("career").length,
      resources: getCuratedResources("career"),
    });
  }
}

// ─── 1. Dev.to Free Articles API ──────────────────────────────────────────────
async function fetchDevToArticles(topic: string): Promise<TechResource[]> {
  try {
    const tag = topic.includes("react") || topic.includes("frontend") ? "react" : topic.includes("python") || topic.includes("data") ? "python" : "career";
    const res = await fetch(`https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 7200 },
    });

    if (!res.ok) return [];
    const articles: Array<{
      id: number;
      title: string;
      description: string;
      url: string;
      tag_list: string[];
      user: { name: string };
      published_at: string;
      public_reactions_count: number;
    }> = await res.json();

    return articles.map((a) => ({
      id: `devto-${a.id}`,
      title: a.title,
      url: a.url,
      description: a.description || "In-depth developer article and career guidance.",
      source: "Dev.to",
      author: a.user?.name || "Dev.to Creator",
      tags: a.tag_list || [tag],
      publishedAt: a.published_at || new Date().toISOString(),
      upvotes: a.public_reactions_count || 0,
    }));
  } catch {
    return [];
  }
}

// ─── 2. HackerNews Algolia Free Search API ────────────────────────────────────
async function fetchHackerNewsPosts(topic: string): Promise<TechResource[]> {
  try {
    const query = `${topic} interview guide tech`;
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=8`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 7200 },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const hits: Array<{
      objectID: string;
      title: string;
      url: string;
      author: string;
      points: number;
      created_at: string;
      _tags: string[];
    }> = data.hits || [];

    return hits
      .filter((h) => h.title)
      .map((h) => ({
        id: `hn-${h.objectID}`,
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        description: `HackerNews tech discussion with ${h.points || 10}+ developer upvotes and community insights.`,
        source: "HackerNews",
        author: h.author,
        tags: ["Community", "Discussion", topic],
        publishedAt: h.created_at || new Date().toISOString(),
        upvotes: h.points || 0,
      }));
  } catch {
    return [];
  }
}

// ─── 3. GitHub Public Trending Search API ─────────────────────────────────────
async function fetchGitHubTrending(topic: string): Promise<TechResource[]> {
  try {
    const queryTopic = topic.replace(/\s+/g, "-");
    const res = await fetch(
      `https://api.github.com/search/repositories?q=topic:${encodeURIComponent(queryTopic)}+stars:>500&sort=stars&order=desc&per_page=6`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 7200 },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    const items: Array<{
      id: number;
      full_name: string;
      html_url: string;
      description: string;
      stargazers_count: number;
      topics: string[];
      owner: { login: string };
      created_at: string;
    }> = data.items || [];

    return items.map((r) => ({
      id: `gh-${r.id}`,
      title: `GitHub: ${r.full_name}`,
      url: r.html_url,
      description: r.description || "Trending open-source repository with high industry relevance.",
      source: "GitHub",
      author: r.owner?.login,
      tags: (r.topics || []).slice(0, 4),
      publishedAt: r.created_at || new Date().toISOString(),
      upvotes: r.stargazers_count,
    }));
  } catch {
    return [];
  }
}

// ─── Curated High-Impact Articles Fallback ────────────────────────────────────
function getCuratedResources(topic: string): TechResource[] {
  return [
    {
      id: "cur-art-1",
      title: "The 2026 Tech Resume Formula: How to Beat ATS and Impress Staff Engineers",
      url: "https://github.com/awesome-cv/awesome-cv",
      description: "Step-by-step guide to framing metric-driven achievements using the Google XYZ formula and clean single-column architecture.",
      source: "Curated",
      author: "CareerForge Engineering Staff",
      tags: ["Resume", "ATS", "Career"],
      publishedAt: new Date().toISOString(),
      upvotes: 428,
    },
    {
      id: "cur-art-2",
      title: "System Design for Early-Career & Mid-Level Developers: Common Architectural Patterns",
      url: "https://github.com/donnemartin/system-design-primer",
      description: "Master caching, load balancing, relational vs NoSQL schemas, and microservice decoupling for modern interviews.",
      source: "Curated",
      author: "Donne Martin",
      tags: ["System Design", "Architecture", "Interviews"],
      publishedAt: new Date().toISOString(),
      upvotes: 1850,
    },
    {
      id: "cur-art-3",
      title: "Behavioral Interview Mastery: Structuring STAR Stories that Convert",
      url: "https://www.freecodecamp.org/news/how-to-ace-the-tech-interview/",
      description: "How to articulate complex technical trade-offs, conflict resolution, and leadership initiatives without sounding generic.",
      source: "Curated",
      author: "Tech Interview Collaborative",
      tags: ["STAR Method", "Behavioral", "Mock Prep"],
      publishedAt: new Date().toISOString(),
      upvotes: 312,
    },
  ];
}
