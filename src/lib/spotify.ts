// Convert a Spotify episode/show URL into an embeddable iframe URL.
// Accepts:
//   https://open.spotify.com/episode/<id>
//   https://open.spotify.com/embed/episode/<id>
//   spotify:episode:<id>
//   bare <id>
// Returns null if the input doesn't look like a Spotify reference.

export function spotifyEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // Already an embed URL — accept as-is (strip query for safety).
  const embedMatch = raw.match(/^https?:\/\/open\.spotify\.com\/embed\/(episode|show)\/([A-Za-z0-9]+)/);
  if (embedMatch) return `https://open.spotify.com/embed/${embedMatch[1]}/${embedMatch[2]}`;

  // Standard share URL.
  const shareMatch = raw.match(/^https?:\/\/open\.spotify\.com\/(episode|show)\/([A-Za-z0-9]+)/);
  if (shareMatch) return `https://open.spotify.com/embed/${shareMatch[1]}/${shareMatch[2]}`;

  // URI form.
  const uriMatch = raw.match(/^spotify:(episode|show):([A-Za-z0-9]+)$/);
  if (uriMatch) return `https://open.spotify.com/embed/${uriMatch[1]}/${uriMatch[2]}`;

  // Bare 22-char base62 id — assume episode.
  if (/^[A-Za-z0-9]{22}$/.test(raw)) return `https://open.spotify.com/embed/episode/${raw}`;

  return null;
}
