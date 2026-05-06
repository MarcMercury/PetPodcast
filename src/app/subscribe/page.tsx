import type { Metadata } from 'next';
import Link from 'next/link';
import { getFeedById } from '@/lib/podcastindex';
import {
  buildListenLinks,
  SPOTIFY_SHOW_URL,
  YOUTUBE_CHANNEL_URL,
  type ListenLink
} from '@/lib/listen-links';
import CopyFeedButton from './copy-feed';

export const metadata: Metadata = {
  title: 'Follow Petspective — Subscribe in your podcast app',
  description:
    'Subscribe to Petspective on Apple Podcasts, Spotify, Overcast, Pocket Casts, YouTube, or via RSS in any podcast app.'
};

// Cache the Podcast Index lookup; the show metadata barely changes.
export const revalidate = 60 * 60 * 24;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.podcast.pet';
const FEED_URL = `${SITE_URL.replace(/\/$/, '')}/feed.xml`;

const PLATFORM_BLURB: Record<ListenLink['platform'], string> = {
  apple: 'iPhone, iPad, Mac.',
  spotify: 'Free or Premium accounts.',
  youtube: 'Watch the video version.',
  overcast: 'Smart speed + voice boost.',
  pocketcasts: 'Cross-platform listening.',
  castro: 'Triage-style queue, iOS.',
  castbox: 'Android-first.',
  podcastindex: 'The open index that powers many apps.',
  rss: 'Paste the feed URL into any podcast app.'
};

const PLATFORM_ORDER: ListenLink['platform'][] = [
  'apple',
  'spotify',
  'youtube',
  'overcast',
  'pocketcasts',
  'castro',
  'castbox',
  'podcastindex'
];

function fallbackLinks(): ListenLink[] {
  // Used when Podcast Index isn't configured or returns nothing.
  // Apple/Overcast/etc. need the iTunes show id, so we omit them here.
  return [
    { platform: 'spotify', label: 'Spotify', url: SPOTIFY_SHOW_URL },
    { platform: 'youtube', label: 'YouTube', url: YOUTUBE_CHANNEL_URL }
  ];
}

export default async function SubscribePage() {
  const piFeedId = process.env.PODCAST_INDEX_FEED_ID;
  const piFeed = piFeedId ? await getFeedById(piFeedId) : null;
  const links = piFeed ? buildListenLinks(piFeed) : fallbackLinks();

  // Order + dedupe by platform; drop the bare 'rss' entry from PI (we render our own block).
  const byPlatform = new Map<ListenLink['platform'], ListenLink>();
  for (const l of links) byPlatform.set(l.platform, l);
  const ordered = PLATFORM_ORDER.map((p) => byPlatform.get(p)).filter(
    (l): l is ListenLink => Boolean(l)
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="eyebrow">Follow the show</p>
      <h1 className="mt-2 text-4xl md:text-5xl font-display font-bold tracking-tight text-cream">
        Subscribe to Petspective
      </h1>
      <p className="mt-4 text-sage-200 leading-relaxed max-w-2xl">
        New episodes auto-deliver to your podcast app the day they go live. Pick the app you
        already use — or paste the RSS feed into anything else.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold text-cream">Listen in your app</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {ordered.map((link) => (
            <li key={link.platform}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex items-start justify-between gap-4 p-5 hover:border-sage-500 transition-colors"
              >
                <div>
                  <div className="font-display font-semibold text-cream">{link.label}</div>
                  <div className="text-sm text-sage-300 mt-1">
                    {PLATFORM_BLURB[link.platform]}
                  </div>
                </div>
                <span aria-hidden className="text-sage-300 mt-1">↗</span>
              </a>
            </li>
          ))}
        </ul>
        {!piFeed && (
          <p className="mt-4 text-xs text-sage-300/70">
            More apps (Apple Podcasts, Overcast, Pocket Casts) appear here once the show finishes
            indexing. In the meantime, copy the RSS feed below and paste it into any app.
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-cream">Use any other app</h2>
        <p className="mt-3 text-sage-200 leading-relaxed">
          Every modern podcast app accepts a feed URL. Copy this and paste it into your app&apos;s
          &ldquo;Add by URL&rdquo; option:
        </p>
        <CopyFeedButton url={FEED_URL} />
        <p className="mt-3 text-xs text-sage-300/70">
          Want the raw XML?{' '}
          <a href="/feed.xml" className="underline-offset-4 hover:underline text-sage-200">
            Open the feed
          </a>
          .
        </p>
      </section>

      <section className="mt-12 card p-6 bg-ink border-sage-700">
        <h2 className="font-display text-lg font-semibold text-cream">Prefer email?</h2>
        <p className="mt-2 text-sage-200 text-sm leading-relaxed">
          One short note per episode. No marketing, no roundups.{' '}
          <Link href="/#subscribe" className="underline-offset-4 hover:underline text-sage-100">
            Join the email list →
          </Link>
        </p>
      </section>

      <div className="mt-12">
        <Link href="/episodes" className="btn-ghost">
          ← Back to episodes
        </Link>
      </div>
    </div>
  );
}
