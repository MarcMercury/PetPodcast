import { createSupabaseServer } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { Episode, ShowNotes, Transcript, Vet } from '@/lib/types';
import TranscriptPlayer from './transcript-player';

export const revalidate = 60;

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
      <header className="grid sm:grid-cols-[200px,1fr] gap-6 items-start">
        <div className="aspect-square rounded-2xl bg-sage-100 overflow-hidden">
          {ep.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ep.image_url} alt={ep.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-sage-600 font-semibold">
            {ep.season ? `Season ${ep.season} · ` : ''}
            {ep.episode_number ? `Episode ${ep.episode_number}` : ''}
          </p>
          <h1 className="mt-2 text-4xl font-extrabold leading-tight">{ep.title}</h1>
          {vet && (
            <p className="mt-3 text-sage-700">
              with <strong>{(vet as Vet).name}</strong>
              {(vet as Vet).clinic_name && ` · ${(vet as Vet).clinic_name}`}
            </p>
          )}
          <p className="mt-3 text-sage-700">{ep.description}</p>
        </div>
      </header>

      {/* Sticky Player + Transcript */}
      <TranscriptPlayer
        audioUrl={ep.audio_url ?? ''}
        title={ep.title}
        segments={(transcript as Transcript | null)?.segments ?? []}
      />

      {/* Show Notes */}
      {notes && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">The Doctor’s Note</h2>
          <p className="mt-3 whitespace-pre-line text-sage-800 leading-relaxed">
            {(notes as ShowNotes).summary}
          </p>

          {(notes as ShowNotes).key_takeaways?.length > 0 && (
            <>
              <h3 className="mt-8 text-lg font-bold">Key Takeaways</h3>
              <ul className="mt-3 space-y-2 list-disc list-inside text-sage-800">
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
