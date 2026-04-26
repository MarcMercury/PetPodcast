import { createSupabaseServer } from '@/lib/supabase/server';
import type { AnimalType, Episode, Vet } from '@/lib/types';
import Link from 'next/link';
import RecallStrip from '@/components/recall-strip';
import BreedOfWeek from '@/components/breed-of-week';

// Filters depend on searchParams, so keep this dynamic.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ANIMAL_FILTERS: { key: AnimalType; label: string }[] = [
  { key: 'canine', label: 'Dogs' },
  { key: 'feline', label: 'Cats' },
  { key: 'exotic', label: 'Exotic' },
  { key: 'avian', label: 'Birds' },
  { key: 'equine', label: 'Equine' }
];

const TOPICS = ['Nutrition', 'Surgery', 'Dental', 'Behavior', 'Wellness', 'Emergency'];

const ANIMAL_KEYS = new Set(ANIMAL_FILTERS.map((f) => f.key));

function fmtDuration(sec?: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function buildHref(params: { animal?: string; topic?: string }) {
  const sp = new URLSearchParams();
  if (params.animal) sp.set('animal', params.animal);
  if (params.topic) sp.set('topic', params.topic);
  const qs = sp.toString();
  return qs ? `/?${qs}#episodes` : '/#episodes';
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: { animal?: string; topic?: string };
}) {
  const supabase = createSupabaseServer();

  const animal =
    searchParams?.animal && ANIMAL_KEYS.has(searchParams.animal as AnimalType)
      ? (searchParams.animal as AnimalType)
      : undefined;
  const topic =
    searchParams?.topic && TOPICS.includes(searchParams.topic) ? searchParams.topic : undefined;

  // If a topic is selected, resolve it to a set of episode IDs via the tags join table.
  let topicEpisodeIds: string[] | null = null;
  if (topic) {
    const slug = topic.toLowerCase();
    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .or(`slug.eq.${slug},name.ilike.${topic}`)
      .maybeSingle();
    if (tag?.id) {
      const { data: links } = await supabase
        .from('episode_tags')
        .select('episode_id')
        .eq('tag_id', tag.id);
      topicEpisodeIds = (links ?? []).map((l) => l.episode_id as string);
    } else {
      topicEpisodeIds = [];
    }
  }

  let epQuery = supabase
    .from('episodes')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(12);

  if (animal) {
    // animal_types is a Postgres enum array — `@>` does an array contains check.
    epQuery = epQuery.contains('animal_types', [animal]);
  }
  if (topicEpisodeIds !== null) {
    if (topicEpisodeIds.length === 0) {
      // No tagged episodes — short-circuit to an empty result.
      epQuery = epQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      epQuery = epQuery.in('id', topicEpisodeIds);
    }
  }

  const [{ data: episodes }, { data: vets }] = await Promise.all([
    epQuery,
    supabase.from('vets').select('*').limit(8)
  ]);

  const filterActive = Boolean(animal || topic);
  // When filters are active, don't promote any episode to "Featured Scope" — show
  // the full filtered list as a clean grid instead.
  const featured = !filterActive ? (episodes?.[0] as Episode | undefined) : undefined;
  const rest = (
    filterActive ? (episodes ?? []) : (episodes ?? []).slice(1)
  ) as Episode[];

  return (
    <>
      {/* Hero — the cover IS the brand. */}
      <section className="relative overflow-hidden border-b border-bone bg-ink">
        <div className="mx-auto max-w-6xl px-6 pt-12 pb-16">
          {/* Top deck — mirrors the "A PODCAST BY EXPERT VETS" line on the cover. */}
          <div className="flex items-center justify-center gap-3 text-sage-300">
            <span className="eq-bars" aria-hidden>
              <span /><span /><span /><span /><span />
            </span>
            <span className="deck-label text-[11px] text-sage-300">A Podcast by Expert Vets</span>
          </div>

          {/* The title cover, full-bleed inside the hero. */}
          <div className="mt-8 rounded-3xl overflow-hidden ring-1 ring-bone shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/title-cover.png"
              alt="Petspective — See Your Pet Through a Vet's Eyes"
              className="w-full h-auto block"
              fetchPriority="high"
            />
          </div>

          {/* CTA row — quiet, sits below the cover so the art carries the page. */}
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="sage-rule" aria-hidden />
            <p className="mt-5 deck-label text-xs text-sage-200">
              Clinical-grade audio. Real veterinarians. The questions you Google at 2am.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href="#episodes" className="btn-primary">▶ Listen Now</a>
              <a href="#ask" className="btn-ghost">Ask a Vet</a>
            </div>
            <div className="mt-8 flex items-center gap-4 text-[10px] text-sage-300/70 font-deck uppercase tracking-deck">
              <span>Vol. 01</span>
              <span aria-hidden>·</span>
              <span>Clinical Media</span>
              <span aria-hidden>·</span>
              <span>podcast.pet</span>
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full bg-sage-700/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-[-120px] h-[320px] w-[320px] rounded-full bg-sage-500/20 blur-3xl"
        />
      </section>

      {/* Brand pillars strip — mirrors the bottom band of the cover. */}
      <section className="bg-sage-800/40 border-b border-bone">
        <div className="mx-auto max-w-6xl px-6 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 text-center divide-y sm:divide-y-0 sm:divide-x divide-bone">
          <div className="px-4 py-2 deck-label text-xs text-cream">Expert Vets</div>
          <div className="px-4 py-2 deck-label text-xs text-cream">Real Answers</div>
          <div className="px-4 py-2 deck-label text-xs text-cream">Better Care</div>
        </div>
      </section>

      {/* Featured Scope */}
      {featured && (
        <section className="mx-auto max-w-6xl px-6 mt-16">
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Featured Scope · Latest Check-up</p>
            <Link
              href={`/episode/${featured.slug}`}
              className="text-xs text-sage-300 hover:text-cream underline-offset-4 hover:underline"
            >
              View episode →
            </Link>
          </div>
          <div className="card grid md:grid-cols-[3fr,4fr] overflow-hidden">
            <div className="aspect-square md:aspect-auto bg-bone relative">
              {featured.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featured.image_url}
                  alt={featured.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-7xl">🩺</div>
              )}
              <span className="absolute top-4 left-4 chip bg-ink/80 text-sage-200 backdrop-blur">
                <span className="eq-bars mr-1.5" aria-hidden><span /><span /><span /><span /><span /></span>
                On Air
              </span>
            </div>
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <p className="eyebrow">
                {featured.season ? `S${featured.season} · ` : ''}
                {featured.episode_number ? `Ep ${featured.episode_number}` : 'New Episode'}
                {fmtDuration(featured.duration_seconds)
                  ? ` · ${fmtDuration(featured.duration_seconds)}`
                  : ''}
              </p>
              <h2 className="mt-3 text-3xl md:text-4xl font-display font-bold leading-tight">
                {featured.title}
              </h2>
              <p className="mt-4 text-sage-200 line-clamp-3 leading-relaxed">
                {featured.description}
              </p>
              <Link href={`/episode/${featured.slug}`} className="btn-primary mt-7 self-start">
                ▶ Play Episode
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Filters + Feed */}
      <section className="mx-auto max-w-6xl px-6 mt-20" id="episodes">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="eyebrow">The Feed</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
              {filterActive ? 'Filtered Episodes' : 'All Episodes'}
            </h2>
            {filterActive && (
              <p className="mt-1 text-sm text-sage-300">
                {[
                  animal && ANIMAL_FILTERS.find((f) => f.key === animal)?.label,
                  topic && `#${topic}`
                ]
                  .filter(Boolean)
                  .join(' · ')}
                <Link href="/#episodes" className="ml-3 text-sage-400 hover:text-cream underline-offset-4 hover:underline">
                  Clear
                </Link>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={buildHref({ topic })}
              className={`chip ${!animal ? 'bg-sage-300 text-ink' : 'hover:bg-sage-700/40'} transition`}
            >
              All
            </Link>
            {ANIMAL_FILTERS.map((f) => {
              const active = animal === f.key;
              return (
                <Link
                  key={f.key}
                  href={buildHref({ animal: active ? undefined : f.key, topic })}
                  className={`chip ${active ? 'bg-sage-300 text-ink' : 'hover:bg-sage-700/40'} transition`}
                  aria-pressed={active}
                >
                  {f.label}
                </Link>
              );
            })}
            <span className="mx-2 h-5 w-px bg-bone" />
            {TOPICS.map((t) => {
              const active = topic === t;
              return (
                <Link
                  key={t}
                  href={buildHref({ animal, topic: active ? undefined : t })}
                  className={`chip ${active ? 'bg-sage-300 text-ink' : 'hover:bg-sage-700/40'} transition`}
                  aria-pressed={active}
                >
                  {t}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.length === 0 && !featured && (
            <p className="text-sage-300 col-span-full">
              {filterActive
                ? 'No episodes match these filters yet.'
                : 'No episodes published yet — check back soon.'}
            </p>
          )}
          {rest.map((ep) => (
            <Link key={ep.id} href={`/episode/${ep.slug}`} className="card group flex flex-col">
              <div className="aspect-square bg-bone overflow-hidden relative">
                {ep.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ep.image_url}
                    alt={ep.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-6xl">🐾</div>
                )}
                {fmtDuration(ep.duration_seconds) && (
                  <span className="absolute bottom-3 right-3 chip bg-ink/80 text-cream border-0">
                    {fmtDuration(ep.duration_seconds)}
                  </span>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="eyebrow text-[10px]">
                  {ep.season ? `S${ep.season} · ` : ''}
                  {ep.episode_number ? `Ep ${ep.episode_number}` : 'Episode'}
                </p>
                <h3 className="mt-2 font-display font-bold text-lg leading-snug group-hover:text-sage-300 transition text-cream">
                  {ep.title}
                </h3>
                <p className="text-sm text-sage-200 mt-2 line-clamp-2 flex-1">{ep.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recall strip — FDA feed */}
      <RecallStrip />

      {/* Breed of the Week */}
      <BreedOfWeek />

      {/* The Pack */}
      <section className="mx-auto max-w-6xl px-6 mt-24" id="vets">
        <p className="eyebrow">The Pack</p>
        <h2 className="mt-2 text-3xl font-display font-bold tracking-tight">Meet the Vets</h2>
        <p className="mt-2 text-sage-200 max-w-2xl">
          Practicing veterinarians &mdash; the voices behind every Petspective
          episode.
        </p>
        <div className="mt-8 grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {(vets ?? []).map((v: Vet) => (
            <div key={v.id} className="card p-6 text-center">
              <div className="mx-auto h-24 w-24 rounded-full bg-bone overflow-hidden ring-1 ring-sage-700">
                {v.bio_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.bio_photo_url} alt={v.name} className="h-full w-full object-cover" />
                )}
              </div>
              <h3 className="mt-4 font-display font-semibold text-cream">{v.name}</h3>
              <p className="text-xs text-sage-300">{v.specialty}</p>
              <p className="text-xs text-sage-400/70 mt-1">{v.clinic_location}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Mailbag */}
      <section className="mx-auto max-w-3xl px-6 mt-24" id="ask">
        <div className="card p-8 md:p-10 bg-ink border-sage-700">
          <p className="eyebrow">The Mailbag</p>
          <h2 className="mt-2 text-3xl font-display font-bold tracking-tight">Ask a Vet</h2>
          <p className="text-sage-200 mt-2 max-w-xl">
            Drop a question. We may answer it on a future Petspective episode.
          </p>
          <form action="/api/mailbag" method="post" className="mt-6 grid gap-3">
            <input
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-sage-300/60 focus:outline-none focus:border-sage-400"
            />
            <textarea
              name="question"
              required
              rows={4}
              placeholder="What's going on with your pet?"
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-sage-300/60 focus:outline-none focus:border-sage-400"
            />
            <button className="btn-primary self-start">Submit Question</button>
          </form>
          <p className="mt-5 text-xs text-sage-300/80">
            Prefer email? Reach us at{' '}
            <a
              href="mailto:petpodcast.pet@gmail.com"
              className="text-cream underline underline-offset-4 hover:text-sage-200"
            >
              petpodcast.pet@gmail.com
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
