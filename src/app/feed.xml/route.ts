// Public RSS 2.0 feed with iTunes Podcast namespace tags.
// Consumed by Apple Podcasts, Spotify for Podcasters, Podcast Index, Overcast, etc.
//
// Notes:
// - Uses the public Supabase server client and only returns rows where
//   status = 'published' (RLS enforces this too).
// - audio_url is a signed URL with a long expiry. Most podcast aggregators
//   accept this, but if any reject it, we can switch to a public bucket and
//   store stable URLs.

import { createSupabaseServer } from '@/lib/supabase/server';
import type { Episode } from '@/lib/types';

export const revalidate = 600; // 10 minutes

const SHOW = {
  title: 'Pet-spective — The Vet’s Eye View',
  description:
    'Pet-spective: clinical-grade conversations with practicing veterinarians on nutrition, surgery, behavior, and the questions every pet owner Googles at 2am.',
  author: 'Pet-spective',
  ownerName: 'Pet-spective',
  ownerEmail: 'petpodcast.pet@gmail.com',
  language: 'en-us',
  copyright: `© ${new Date().getFullYear()} Pet-spective`,
  category: 'Health & Fitness',
  explicit: 'false' as const,
  type: 'episodic' as const
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function rfc2822(d: string | null | undefined): string {
  const date = d ? new Date(d) : new Date();
  return date.toUTCString();
}

function durationHHMMSS(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.podcast.pet';
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('episodes')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(500);

  const episodes = (data ?? []) as Episode[];

  // Show-level artwork. Apple requires 1400×1400 to 3000×3000 JPG/PNG, RGB.
  // We always serve a stable show cover from /public so directories see the
  // same image regardless of episode count or per-episode art.
  // Regenerate via `node scripts/generate-show-cover.mjs`.
  const showImage = `${siteUrl}/brand/show-cover.jpg`;

  const items = episodes
    .map((ep) => {
      const epUrl = `${siteUrl}/episode/${ep.slug}`;
      const audioUrl = ep.audio_url ?? '';
      // <enclosure> requires a length; we don't track byte size, so emit 0
      // and rely on duration. Apple/Spotify accept this.
      const enclosureType = audioUrl.toLowerCase().includes('.wav')
        ? 'audio/wav'
        : audioUrl.toLowerCase().includes('.m4a') || audioUrl.toLowerCase().includes('.mp4')
        ? 'audio/mp4'
        : 'audio/mpeg';
      return `    <item>
      <title>${escapeXml(ep.title)}</title>
      <link>${escapeXml(epUrl)}</link>
      <guid isPermaLink="false">${escapeXml(ep.id)}</guid>
      <pubDate>${rfc2822(ep.published_at)}</pubDate>
      <description>${cdata(ep.description ?? '')}</description>
      <itunes:summary>${cdata(ep.description ?? '')}</itunes:summary>
      <itunes:explicit>${SHOW.explicit}</itunes:explicit>
      <itunes:duration>${durationHHMMSS(ep.duration_seconds)}</itunes:duration>
      ${ep.season ? `<itunes:season>${ep.season}</itunes:season>` : ''}
      ${ep.episode_number ? `<itunes:episode>${ep.episode_number}</itunes:episode>` : ''}
      ${ep.image_url ? `<itunes:image href="${escapeXml(ep.image_url)}"/>` : ''}
      ${
        audioUrl
          ? `<enclosure url="${escapeXml(audioUrl)}" length="0" type="${enclosureType}"/>`
          : ''
      }
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:podcast="https://podcastindex.org/namespace/1.0"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SHOW.title)}</title>
    <link>${escapeXml(siteUrl)}</link>
    <description>${cdata(SHOW.description)}</description>
    <language>${SHOW.language}</language>
    <copyright>${escapeXml(SHOW.copyright)}</copyright>
    <atom:link href="${escapeXml(siteUrl)}/feed.xml" rel="self" type="application/rss+xml"/>
    <podcast:guid>202d073a-09b2-50e6-9cc8-a791655e7a6b</podcast:guid>
    <podcast:locked owner="${escapeXml(SHOW.ownerEmail)}">yes</podcast:locked>
    <itunes:author>${escapeXml(SHOW.author)}</itunes:author>
    <itunes:summary>${cdata(SHOW.description)}</itunes:summary>
    <itunes:type>${SHOW.type}</itunes:type>
    <itunes:explicit>${SHOW.explicit}</itunes:explicit>
    <itunes:owner>
      <itunes:name>${escapeXml(SHOW.ownerName)}</itunes:name>
      <itunes:email>${escapeXml(SHOW.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${escapeXml(showImage)}"/>
    <itunes:category text="${escapeXml(SHOW.category)}"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600'
    }
  });
}
