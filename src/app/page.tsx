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
  searchParams?: { animal?: string; topic?: string; subscribed?: string };
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
          {/* The title cover, full-bleed inside the hero. The cover art already
              carries the "A PODCAST BY EXPERT VETS" deck, so we don't repeat it here. */}
          <div className="rounded-3xl overflow-hidden ring-1 ring-bone shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
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
            <div className="flex flex-wrap justify-center gap-3">
              <a href="/episodes" className="btn-primary">▶ Listen Now</a>
              <a
                href="https://open.spotify.com/show/1d2EE3HdRE2LzqdyInWTR0"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Listen on Spotify
              </a>
              <a
                href="https://www.youtube.com/@PetPetspective"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Watch on YouTube
              </a>
              <a
                href="https://instagram.com/petspective.podcast"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Follow on Instagram
              </a>
              <a href="#ask" className="btn-ghost">Ask a Vet</a>
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
        <h2 className="text-3xl font-display font-bold tracking-tight">Meet the Pack</h2>
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

      {/* How the show works — show structure context */}
      <section className="mx-auto max-w-5xl px-6 mt-24">
        <p className="eyebrow text-center">How the Show Works</p>
        <h2 className="mt-2 text-center text-3xl font-display font-bold tracking-tight">
          Two segments. One planned. One pulled from a hat.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sage-200">
          Every Petspective episode runs the same shape: a deep dive on the night&apos;s
          planned topic, then a live <strong className="text-cream">Wildcard</strong> round
          where a random-question generator pulls straight from the listener queue.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="card p-6 bg-ink border-sage-700">
            <p className="eyebrow">Segment 1</p>
            <h3 className="mt-2 text-xl font-display font-bold">The Planned Topic</h3>
            <p className="mt-2 text-sage-200 text-sm leading-relaxed">
              A focused, prepped conversation with our vets — nutrition, surgery, dental,
              behavior, emergency, whatever the week calls for. Researched, sourced, and
              built around real cases.
            </p>
          </div>
          <div className="card p-6 bg-ink border-sage-700">
            <p className="eyebrow">Segment 2</p>
            <h3 className="mt-2 text-xl font-display font-bold">The Wildcard Round</h3>
            <p className="mt-2 text-sage-200 text-sm leading-relaxed">
              We hit a random question generator live on air. It pulls one of your
              submissions out of the queue — on topic, off topic, weirdly specific,
              wildly general — and the vets answer it cold.
            </p>
          </div>
        </div>
      </section>

      {/* Subscribe — listener email opt-in for new episode drops */}
      <section className="mx-auto max-w-3xl px-6 mt-24" id="subscribe">
        <div className="card p-8 md:p-10 bg-ink border-sage-700">
          <p className="eyebrow">The Drop List</p>
          <h2 className="mt-2 text-3xl font-display font-bold tracking-tight">
            Get a heads-up when a new episode drops.
          </h2>
          <p className="text-sage-200 mt-3 max-w-xl leading-relaxed">
            One email per episode. No marketing, no roundups, no sponsor promos —
            just the new episode link the day it goes live. Unsubscribe anytime.
          </p>
          {searchParams?.subscribed === '1' && (
            <p className="mt-4 rounded-lg bg-sage-700/30 text-sage-100 px-3 py-2 text-sm">
              You&apos;re on the list. We&apos;ll only email when a new episode drops.
            </p>
          )}
          {searchParams?.subscribed === 'invalid' && (
            <p className="mt-4 rounded-lg bg-red-900/40 text-red-200 px-3 py-2 text-sm">
              That doesn&apos;t look like a valid email — try again?
            </p>
          )}
          {searchParams?.subscribed === 'error' && (
            <p className="mt-4 rounded-lg bg-red-900/40 text-red-200 px-3 py-2 text-sm">
              Something went sideways saving that. Try again in a minute.
            </p>
          )}
          <form action="/api/subscribe" method="post" className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              autoComplete="email"
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-sage-300/60 focus:outline-none focus:border-sage-400"
            />
            <input type="hidden" name="source" value="home" />
            <button className="btn-primary self-start sm:self-auto">Subscribe</button>
          </form>
          <p className="text-sage-300/70 mt-3 text-xs leading-relaxed">
            Prefer a podcast app?{' '}
            <a href="/feed.xml" className="underline-offset-4 hover:underline text-sage-200">
              Subscribe via RSS
            </a>{' '}
            or on{' '}
            <a
              href="https://open.spotify.com/show/1d2EE3HdRE2LzqdyInWTR0"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline text-sage-200"
            >
              Spotify
            </a>
            .
          </p>
        </div>
      </section>

      {/* The Mailbag */}
      <section className="mx-auto max-w-3xl px-6 mt-24" id="ask">
        <div className="card p-8 md:p-10 bg-ink border-sage-700">
          <p className="eyebrow">The Mailbag · Wildcard Queue</p>
          <h2 className="mt-2 text-3xl font-display font-bold tracking-tight">Ask a Vet</h2>
          <p className="text-sage-200 mt-3 max-w-xl leading-relaxed">
            Every question you submit drops into the <strong className="text-cream">Wildcard
            queue</strong>. During the back half of each episode we run a random question
            generator live on air — whatever it pulls, the vets answer.
          </p>
          <p className="text-sage-200 mt-3 max-w-xl leading-relaxed">
            That means there&apos;s no &ldquo;wrong&rdquo; question. Ask something general,
            ask something hyper-specific, ask something completely off topic. If the
            generator pulls your card, it goes on the show.
          </p>
          <p className="text-sage-300/80 mt-3 max-w-xl text-sm leading-relaxed">
            Heads up: submissions are one-way. We don&apos;t reply to questions
            individually &mdash; the only response is on air, if the generator pulls your card.
          </p>
          <form action="/api/mailbag" method="post" className="mt-6 grid gap-3">
            <textarea
              name="question"
              required
              rows={4}
              placeholder="Anything goes — on topic, off topic, serious, silly. The generator decides."
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 placeholder:text-sage-300/60 focus:outline-none focus:border-sage-400"
            />
            <button className="btn-primary self-start">Drop It in the Queue</button>
          </form>
        </div>
      </section>
    </>
  );
}
