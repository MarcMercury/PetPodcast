// Podcast Index API client (read-only).
// Auth: SHA-1 of (key + secret + unix_timestamp) in the Authorization header.
// Docs: https://podcastindex-org.github.io/docs-api/

import { createHash } from 'crypto';

const BASE = 'https://api.podcastindex.org/api/1.0';

function authHeaders(): HeadersInit {
  const key = process.env.PODCAST_INDEX_KEY;
  const secret = process.env.PODCAST_INDEX_SECRET;
  if (!key || !secret) throw new Error('PODCAST_INDEX_KEY / PODCAST_INDEX_SECRET not set');
  const ts = Math.floor(Date.now() / 1000).toString();
  const hash = createHash('sha1').update(key + secret + ts).digest('hex');
  return {
    'X-Auth-Date': ts,
    'X-Auth-Key': key,
    Authorization: hash,
    'User-Agent': 'PetPodcast/1.0'
  };
}

export interface PodcastIndexFeed {
  id: number;
  title: string;
  url: string;
  link: string | null;
  description: string | null;
  image: string | null;
  itunesId: number | null;
  language: string | null;
}

// Returns null if the feed isn't found or the API is misconfigured.
export async function getFeedById(feedId: number | string): Promise<PodcastIndexFeed | null> {
  if (!feedId) return null;
  try {
    const res = await fetch(`${BASE}/podcasts/byfeedid?id=${encodeURIComponent(String(feedId))}`, {
      headers: authHeaders(),
      // Cache for 24 hours; the show metadata (title, itunesId) doesn't change.
      next: { revalidate: 60 * 60 * 24, tags: ['podcastindex-feed'] }
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: string | boolean; feed?: PodcastIndexFeed };
    if (!j.feed || j.feed.id == null) return null;
    return j.feed;
  } catch {
    return null;
  }
}
