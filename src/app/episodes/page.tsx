import { createSupabaseServer } from '@/lib/supabase/server';
import type { AnimalType, Episode } from '@/lib/types';
import Link from 'next/link';

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
  return qs ? `/episodes?${qs}` : '/episodes';
}

export default async function EpisodesPage({
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
    .limit(60);

  if (animal) {
    epQuery = epQuery.contains('animal_types', [animal]);
  }
  if (topicEpisodeIds !== null) {
    if (topicEpisodeIds.length === 0) {
      epQuery = epQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    } else {
      epQuery = epQuery.in('id', topicEpisodeIds);
    }
  }

  const { data: episodes } = await epQuery;
  const list = (episodes ?? []) as Episode[];
  const filterActive = Boolean(animal || topic);
  const isEmpty = list.length === 0;

  return (
    <>
      {/* Page header */}
      <section className="border-b border-bone bg-ink">
        <div className="mx-auto max-w-6xl px-6 pt-14 pb-10">
          <p className="eyebrow">The Feed</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-extrabold tracking-tight text-cream">
            Episodes
          </h1>
          <p className="mt-3 max-w-2xl text-sage-200">
            Clinical-grade conversations with practicing veterinarians. Filter by species
            or topic to find the check-up you need.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-6xl px-6 mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({ topic })}
            className={`chip ${!animal ? 'bg-sage-300 text-ink' : 'hover:bg-sage-700/40'} transition`}
            aria-pressed={!animal}
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
          {filterActive && (
            <Link
              href="/episodes"
              className="ml-2 text-xs text-sage-300 hover:text-cream underline-offset-4 hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      </section>

      {/* Feed grid */}
      <section className="mx-auto max-w-6xl px-6 mt-8 mb-24">
        {!isEmpty ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map((ep) => (
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
                  <p className="text-sm text-sage-200 mt-2 line-clamp-2 flex-1">
                    {ep.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState filterActive={filterActive} />
        )}
      </section>
    </>
  );
}

function EmptyState({ filterActive }: { filterActive: boolean }) {
  // Outline / placeholder of what an episode card will look like once Season 1 ships.
  const placeholders = [
    { eyebrow: 'S1 · Ep 01', title: 'The 2am Symptom Check', topic: 'Wellness' },
    { eyebrow: 'S1 · Ep 02', title: 'What Your Vet Wishes You Knew About Food', topic: 'Nutrition' },
    { eyebrow: 'S1 · Ep 03', title: 'When a Limp Is an Emergency', topic: 'Emergency' }
  ];

  return (
    <div>
      {/* Status banner */}
      <div className="card p-8 md:p-10 bg-ink border-sage-700">
        <div className="flex items-center gap-3 text-sage-300">
          <span className="eq-bars" aria-hidden>
            <span /><span /><span /><span /><span />
          </span>
          <span className="deck-label text-[11px]">Season 01 · In Production</span>
        </div>
        <h2 className="mt-4 text-2xl md:text-3xl font-display font-bold text-cream">
          {filterActive ? 'No episodes match these filters yet.' : 'Episodes drop soon.'}
        </h2>
        <p className="mt-3 max-w-2xl text-sage-200">
          {filterActive
            ? 'Once Season 1 ships, your filtered view will live here. In the meantime, clear the filters to see the full upcoming lineup, or send us a question for the show.'
            : 'Petspective is taping Season 1 with practicing veterinarians right now. Subscribe via RSS, or drop a question and we may answer it on a future episode.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {filterActive ? (
            <Link href="/episodes" className="btn-primary">Clear filters</Link>
          ) : (
            <a href="/feed.xml" className="btn-primary">Subscribe via RSS</a>
          )}
          <Link href="/#ask" className="btn-ghost">Ask a Vet</Link>
        </div>
      </div>

      {/* Skeleton card outline — shows the future shape of the feed. */}
      <div className="mt-10">
        <p className="eyebrow">What the feed will look like</p>
        <div
          className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          aria-hidden
        >
          {placeholders.map((p, i) => (
            <div
              key={i}
              className="card flex flex-col opacity-70"
            >
              <div className="aspect-square bg-bone/60 relative grid place-items-center">
                <div className="absolute inset-0 bg-gradient-to-br from-sage-700/30 to-ink/20" />
                <span className="relative text-6xl text-sage-300/70">🩺</span>
                <span className="absolute bottom-3 right-3 chip bg-ink/80 text-cream border-0">
                  ~ 35 min
                </span>
                <span className="absolute top-3 left-3 chip bg-ink/80 text-sage-200 backdrop-blur">
                  Coming Soon
                </span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="eyebrow text-[10px]">{p.eyebrow} · #{p.topic}</p>
                <h3 className="mt-2 font-display font-bold text-lg leading-snug text-cream/90">
                  {p.title}
                </h3>
                <div className="mt-3 space-y-2 flex-1">
                  <div className="h-2 rounded bg-bone/40 w-full" />
                  <div className="h-2 rounded bg-bone/40 w-5/6" />
                  <div className="h-2 rounded bg-bone/40 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
