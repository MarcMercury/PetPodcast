// Studio — the one place to take an episode from blank → published.
// Server entry: loads everything the client editor needs in one shot.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import StudioClient from './studio-client';

export const dynamic = 'force-dynamic';

export default async function StudioPage({ params }: { params: { id: string } }) {
  const { data: ep } = await supabaseAdmin
    .from('episodes')
    .select(
      'id, slug, title, description, season, episode_number, status, audio_url, image_url, spotify_url, breed_species, breed_slug, published_at'
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!ep) notFound();

  // Studio bundle (audio paths + transcript + project state) goes through
  // our own API so the page and the client share the same code path.
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  const cookie = h.get('cookie') ?? '';
  const [studioRes, { data: notes }, { data: tmeta }] = await Promise.all([
    fetch(`${proto}://${host}/api/admin/episodes/${params.id}/studio`, {
      headers: { cookie },
      cache: 'no-store'
    }),
    supabaseAdmin
      .from('show_notes')
      .select('summary, key_takeaways, suggested_image_prompt')
      .eq('episode_id', ep.id)
      .maybeSingle(),
    supabaseAdmin
      .from('transcripts')
      .select('language, entity_links')
      .eq('episode_id', ep.id)
      .maybeSingle()
  ]);
  const initial = studioRes.ok ? await studioRes.json() : null;
  const entityLinkCount = Array.isArray(tmeta?.entity_links)
    ? (tmeta!.entity_links as unknown[]).length
    : 0;

  const audioBucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AUDIO || 'pet-podcast-audio';

  return (
    <StudioClient
      audioBucket={audioBucket}
      initial={initial}
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
        breed_slug: ep.breed_slug ?? null,
        published_at: ep.published_at ?? null
      }}
      pipeline={{
        hasTranscript: Boolean(tmeta),
        transcriptLanguage: tmeta?.language ?? null,
        hasShowNotes: Boolean(notes?.summary),
        showNotesSummary: notes?.summary ?? null,
        showNotesTakeaways: (notes?.key_takeaways as string[] | null) ?? null,
        suggestedImagePrompt: notes?.suggested_image_prompt ?? null,
        entityLinkCount
      }}
    />
  );
}
