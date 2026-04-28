// Build cross-platform "listen everywhere" links from a Podcast Index feed.
// Most apps deep-link via the Apple iTunes show ID.

import type { PodcastIndexFeed } from './podcastindex';

// Petspective on Spotify (show-level link). Stable identifier — does not change per episode.
export const SPOTIFY_SHOW_URL = 'https://open.spotify.com/show/1d2EE3HdRE2LzqdyInWTR0';

// Petspective on YouTube. Channel-level link (handle).
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@PetPetspective';

export interface ListenLink {
  platform: 'apple' | 'spotify' | 'youtube' | 'overcast' | 'pocketcasts' | 'castro' | 'castbox' | 'podcastindex' | 'rss';
  label: string;
  url: string;
}

export function buildListenLinks(feed: PodcastIndexFeed): ListenLink[] {
  const links: ListenLink[] = [];
  const itunesId = feed.itunesId;

  links.push({
    platform: 'spotify',
    label: 'Spotify',
    url: SPOTIFY_SHOW_URL
  });

  links.push({
    platform: 'youtube',
    label: 'YouTube',
    url: YOUTUBE_CHANNEL_URL
  });

  if (itunesId) {
    links.push({
      platform: 'apple',
      label: 'Apple Podcasts',
      url: `https://podcasts.apple.com/podcast/id${itunesId}`
    });
    links.push({
      platform: 'overcast',
      label: 'Overcast',
      url: `https://overcast.fm/itunes${itunesId}`
    });
    links.push({
      platform: 'pocketcasts',
      label: 'Pocket Casts',
      url: `https://pca.st/itunes/${itunesId}`
    });
    links.push({
      platform: 'castro',
      label: 'Castro',
      url: `https://castro.fm/itunes/${itunesId}`
    });
    links.push({
      platform: 'castbox',
      label: 'Castbox',
      url: `https://castbox.fm/vic/${itunesId}`
    });
  }

  links.push({
    platform: 'podcastindex',
    label: 'Podcast Index',
    url: `https://podcastindex.org/podcast/${feed.id}`
  });

  if (feed.url) {
    links.push({ platform: 'rss', label: 'RSS', url: feed.url });
  }

  return links;
}
