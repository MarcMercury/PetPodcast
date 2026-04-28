import { createSupabaseServer } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Episode, ShowNotes, Transcript, Vet } from '@/lib/types';
import type { Metadata } from 'next';
import TranscriptPlayer from './transcript-player';
import { spotifyEmbedUrl } from '@/lib/spotify';
import { getFeedById } from '@/lib/podcastindex';
import { buildListenLinks } from '@/lib/listen-links';

export const revalidate = 60;

// React.cache dedupes within a single request \u2014 generateMetadata and the page
// component both call this, but we only hit Supabase once.
const getEpisodeBySlug = cache(async (slug: string) => {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('episodes')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as Episode | null) ?? null;
});

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const ep = await getEpisodeBySlug(params.slug);
  if (!ep) return { title: 'Petspective' };
  return {
    title: `${ep.title} \u2014 Petspective`,
    description: ep.description ?? 'See Your Pet Through a Vet\u2019s Eyes.',
    openGraph: {
      title: `${ep.title} \u2014 Petspective`,
      description: ep.description ?? '',
      images: ep.image_url ? [{ url: ep.image_url }] : undefined,
      siteName: 'Petspective',
      type: 'article'
    }
  };
}

export default async function EpisodePage({ params }: { params: { slug: string } }) {
  const supabase = createSupabaseServer();

  const episode = await getEpisodeBySlug(params.slug);
  if (!episode) notFound();
  const ep = episode;

  const [{ data: transcript }, { data: notes }, { data: vet }] = await Promise.all([
    supabase.from('transcripts').select('*').eq('episode_id', ep.id).maybeSingle(),
    supabase.from('show_notes').select('*').eq('episode_id', ep.id).maybeSingle(),
    ep.guest_vet_id
      ? supabase.from('vets').select('*').eq('id', ep.guest_vet_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  const piFeedId = process.env.PODCAST_INDEX_FEED_ID;
  const piFeed = piFeedId ? await getFeedById(piFeedId) : null;
  const listenLinks = piFeed ? buildListenLinks(piFeed) : [];

  return (
    <article className="mx-auto max-w-4xl px-6 py-12">
      {/* Header */}
      <p className="eyebrow">Petspective · Episode</p>
      <header className="mt-3 grid sm:grid-cols-[220px,1fr] gap-6 items-start">
        <div className="aspect-square rounded-2xl bg-bone overflow-hidden ring-1 ring-sage-700">
          {ep.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ep.image_url} alt={ep.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-brand text-sage-300 font-semibold font-deck">
            {ep.season ? `Season ${ep.season} · ` : ''}
            {ep.episode_number ? `Episode ${ep.episode_number}` : ''}
          </p>
          <h1 className="mt-2 text-4xl font-display font-bold leading-tight tracking-tight">{ep.title}</h1>
          {vet && (
            <p className="mt-3 text-sage-200">
              with <strong className="text-cream">{(vet as Vet).name}</strong>
              {(vet as Vet).clinic_name && ` · ${(vet as Vet).clinic_name}`}
            </p>
          )}
          <p className="mt-3 text-sage-200 leading-relaxed">{ep.description}</p>
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

      {/* Listen everywhere (Podcast Index) */}
      {listenLinks.length > 0 && (
        <section className="mt-8">
          <p className="eyebrow">Also available on</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {listenLinks.map((l) => (
              <a
                key={l.platform}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="chip hover:bg-sage-700/40"
              >
                {l.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Show Notes */}
      {notes && (
        <section className="mt-12">
          <p className="eyebrow">The Doctor’s Note</p>
          <h2 className="mt-2 text-2xl font-display font-bold tracking-tight">Show Notes</h2>
          <p className="mt-4 whitespace-pre-line text-sage-100 leading-relaxed">
            {(notes as ShowNotes).summary}
          </p>

          {(notes as ShowNotes).key_takeaways?.length > 0 && (
            <>
              <h3 className="mt-8 text-lg font-display font-bold">Key Takeaways</h3>
              <ul className="mt-3 space-y-2 list-disc list-inside text-sage-100">
                {(notes as ShowNotes).key_takeaways.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* Show structure footer — explain the wildcard segment to single-episode visitors */}
      <aside className="mt-16 rounded-2xl border border-sage-700 bg-ink/60 p-6">
        <p className="eyebrow">About the Format</p>
        <h3 className="mt-2 text-lg font-display font-bold">Planned topic, then Wildcard</h3>
        <p className="mt-2 text-sage-200 text-sm leading-relaxed">
          Every Petspective episode opens with a planned, researched topic and closes with
          a <strong className="text-cream">Wildcard round</strong> — we run a random
          question generator live on air against the listener mailbag. Anything in the
          queue can come up: on topic, off topic, general, hyper-specific.
        </p>
        <p className="mt-3 text-sm">
          <a
            href="/#ask"
            className="text-cream underline underline-offset-4 hover:text-sage-200"
          >
            Drop a question in the Wildcard queue →
          </a>
        </p>
      </aside>
    </article>
  );
}
