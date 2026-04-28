// Episode hub — landing page for an existing episode (draft or published).
// Wraps everything you can do to one episode: edit metadata, run the AI
// pipeline, jump to Studio, manage cover art, publish/unpublish, delete.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import EpisodeHubClient from './hub-client';

export const dynamic = 'force-dynamic';

export default async function EpisodeHubPage({ params }: { params: { id: string } }) {
  const { data: ep } = await supabaseAdmin
    .from('episodes')
    .select(
      'id, slug, title, description, season, episode_number, status, audio_url, image_url, spotify_url, breed_species, breed_slug, published_at, created_at'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!ep) notFound();

  // Pipeline state — what's been generated so far.
  const [{ data: transcript }, { data: notes }] = await Promise.all([
    // Don't pull raw_text here — we only need to know whether a transcript exists
    // and how many entity_links it has. raw_text can be megabytes.
    supabaseAdmin
      .from('transcripts')
      .select('language, entity_links')
      .eq('episode_id', ep.id)
      .maybeSingle(),
    supabaseAdmin
      .from('show_notes')
      .select('summary, key_takeaways, suggested_image_prompt')
      .eq('episode_id', ep.id)
      .maybeSingle()
  ]);

  const entityLinkCount = Array.isArray(transcript?.entity_links)
    ? (transcript!.entity_links as unknown[]).length
    : 0;

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wide text-sage-500">
            {ep.season ? `S${ep.season} · ` : ''}
            {ep.episode_number !== null && ep.episode_number !== undefined
              ? `Ep ${ep.episode_number}`
              : 'Episode'}
          </p>
          <h1 className="font-display text-3xl font-bold">{ep.title}</h1>
          <p className="mt-1 text-xs text-sage-500">
            <span
              className={`rounded-full px-2 py-0.5 mr-2 uppercase font-semibold ${
                ep.status === 'published'
                  ? 'bg-emerald-100 text-emerald-800'
                  : ep.status === 'draft'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-sage-100 text-sage-700'
              }`}
            >
              {ep.status}
            </span>
            slug: <span className="font-mono">{ep.slug}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/episodes/${ep.id}/studio`}
            className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50"
          >
            Open Studio →
          </Link>
          {ep.status === 'published' && (
            <Link
              href={`/episode/${ep.slug}`}
              target="_blank"
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50"
            >
              View live ↗
            </Link>
          )}
        </div>
      </div>

      <EpisodeHubClient
        episode={{
          id: ep.id,
          slug: ep.slug,
          title: ep.title,
          description: ep.description ?? '',
          season: ep.season ?? null,
          episode_number: ep.episode_number ?? null,
          status: ep.status,
          audio_url: ep.audio_url ?? null,
          image_url: ep.image_url ?? null,
          spotify_url: ep.spotify_url ?? null,
          breed_species: (ep.breed_species as 'dog' | 'cat' | null) ?? null,
          breed_slug: ep.breed_slug ?? null
        }}
        pipeline={{
          hasTranscript: Boolean(transcript),
          transcriptLanguage: transcript?.language ?? null,
          hasShowNotes: Boolean(notes?.summary),
          showNotesSummary: notes?.summary ?? null,
          showNotesTakeaways: (notes?.key_takeaways as string[] | null) ?? null,
          suggestedImagePrompt: notes?.suggested_image_prompt ?? null,
          entityLinkCount: entityLinkCount
        }}
        audioBucket={process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AUDIO || 'pet-podcast-audio'}
      />
    </div>
  );
}
