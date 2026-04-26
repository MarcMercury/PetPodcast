-- ============================================================
-- Pet Podcast — add Spotify embed URL to episodes
-- ============================================================
-- Stores the canonical Spotify episode URL (e.g.
-- https://open.spotify.com/episode/<id>). Rendered as an
-- iframe embed on the public episode page.

alter table pet_podcast.episodes
  add column if not exists spotify_url text;
