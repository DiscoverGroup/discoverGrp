import express, { Request, Response } from "express";

const router = express.Router();

// In-memory cache so we don't hammer the Graph API on every page load
interface CacheEntry {
  data: FacebookPost[];
  fetchedAt: number;
}
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface FacebookPost {
  id: string;
  message?: string;
  full_picture?: string;
  permalink_url: string;
  created_time: string;
}

/**
 * GET /api/facebook/posts
 * Returns the latest posts from the Discover Group Facebook page.
 * Requires FB_PAGE_ACCESS_TOKEN env var (long-lived Page Access Token).
 * Results are cached for 10 minutes to avoid Graph API rate limits.
 */
router.get("/posts", async (_req: Request, res: Response) => {
  try {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!token) {
      // Token not configured — return empty so the UI hides itself gracefully
      return res.json({ posts: [], configured: false });
    }

    // Return cached data if still fresh
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ posts: cache.data, configured: true });
    }

    const fields = "id,message,full_picture,permalink_url,created_time";
    const url =
      `https://graph.facebook.com/v19.0/discovergrp/posts` +
      `?fields=${fields}&limit=6&access_token=${token}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Facebook Graph API error:", response.status, errBody);
      // Return stale cache if available rather than breaking the page
      if (cache) return res.json({ posts: cache.data, configured: true });
      return res.status(502).json({ error: "Failed to fetch posts from Facebook" });
    }

    const json = (await response.json()) as { data?: FacebookPost[] };
    const posts: FacebookPost[] = json.data ?? [];

    cache = { data: posts, fetchedAt: Date.now() };
    return res.json({ posts, configured: true });
  } catch (err) {
    console.error("Error fetching Facebook posts:", err);
    if (cache) return res.json({ posts: cache.data, configured: true });
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
