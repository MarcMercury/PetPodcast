import { createSupabaseServer } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Episode, ShowNotes, Transcript, Vet } from '@/lib/types';
import type { Metadata } from 'next';
import TranscriptPlayer from './transcript-player';
import { spotifyEmbedUrl } from '@/lib/spotify';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('episodes')
    .select('title,description,image_url')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!data) return { title: 'Petspective' };
  const ep = data as Pick<Episode, 'title' | 'description' | 'image_url'>;
  return {
    title: `${ep.title} — Petspective`,
    description: ep.description ?? 'See Your Pet Through a Vet’s Eyes — a Green Dog production.',
    openGraph: {
      title: `${ep.title} — Petspective`,
      description: ep.description ?? '',
      images: ep.image_url ? [{ url: ep.image_url }] : undefined,
      siteName: 'Petspective',
      type: 'article'
    }
  };
}

export default async function EpisodePage({ params }: { params: { slug: string } }) {
  const supabase = createSupabaseServer();

  const { data: episode } = await supabase
    .from('episodes')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (!episode) notFound();
  const ep = episode as Episode;

  const [{ data: transcript }, { data: notes }, { data: vet }] = await Promise.all([
    supabase.from('transcripts').select('*').eq('episode_id', ep.id).maybeSingle(),
    supabase.from('show_notes').select('*').eq('episode_id', ep.id).maybeSingle(),
    ep.guest_vet_id
      ? supabase.from('vets').select('*').eq('id', ep.guest_vet_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <p className="eyebrow">Petspective · Episode</p>
      <header className="mt-3 grid sm:grid-cols-[220px,1fr] gap-6 items-start">
        <div className="aspect-square rounded-2xl bg-bone overflow-hidden ring-1 ring-bone">
          {ep.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ep.image_url} alt={ep.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-brand text-sage-700 font-semibold">
            {ep.season ? `Season ${ep.season} · ` : ''}
            {ep.episode_number ? `Episode ${ep.episode_number}` : ''}
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight">{ep.title}</h1>
          {vet && (
            <p className="mt-3 text-sage-800">
              with <strong>{(vet as Vet).name}</strong>
              {(vet as Vet).clinic_name && ` · ${(vet as Vet).clinic_name}`}
            </p>
          )}
          <p className="mt-3 text-sage-700 leading-relaxed">{ep.description}</p>
        </div>
      </header>

      {/* Sticky Player + Transcript */}
      <TranscriptPlayer
        audioUrl={ep.audio_url ?? ''}
        title={ep.title}
        segments={(transcript as Transcript | null)?.segments ?? []}
        chapters={(notes as ShowNotes | null)?.chapters ?? []}
        entityLinks={(transcript as Transcript | null)?.entity_links ?? []}
      />

      {/* Spotify embed */}
      {(() => {
        const embed = spotifyEmbedUrl(ep.spotify_url);
        if (!embed) return null;
        return (
          <section className="mt-10">
            <p className="eyebrow">Listen on Spotify</p>
            <div className="mt-3 rounded-2xl overflow-hidden ring-1 ring-bone">
              <iframe
                src={embed}
                title={`${ep.title} on Spotify`}
                width="100%"
                height="232"
                frameBorder={0}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            </div>
          </section>
        );
      })()}

      {/* Show Notes */}
      {notes && (
        <section className="mt-12">
          <p className="eyebrow">The Doctor’s Note</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Show Notes</h2>
          <p className="mt-4 whitespace-pre-line text-sage-900 leading-relaxed">
            {(notes as ShowNotes).summary}
          </p>

          {(notes as ShowNotes).key_takeaways?.length > 0 && (
            <>
              <h3 className="mt-8 text-lg font-bold">Key Takeaways</h3>
              <ul className="mt-3 space-y-2 list-disc list-inside text-sage-900">
                {(notes as ShowNotes).key_takeaways.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </article>
  );
}
