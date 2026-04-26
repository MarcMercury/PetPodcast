import { createSupabaseServer } from '@/lib/supabase/server';
import type { Episode, Vet } from '@/lib/types';
import Link from 'next/link';

export const revalidate = 60;

const ANIMAL_FILTERS = [
  { key: 'canine', label: 'Dogs 🐶' },
  { key: 'feline', label: 'Cats 🐱' },
  { key: 'exotic', label: 'Exotic 🦎' },
  { key: 'avian', label: 'Birds 🦜' },
  { key: 'equine', label: 'Equine 🐴' }
];

const TOPICS = ['Nutrition', 'Surgery', 'Dental', 'Behavior', 'Wellness', 'Emergency'];

export default async function HomePage() {
  const supabase = createSupabaseServer();

  const [{ data: episodes }, { data: vets }] = await Promise.all([
    supabase
      .from('episodes')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(12),
    supabase.from('vets').select('*').limit(8)
  ]);

  const featured = episodes?.[0] as Episode | undefined;
  const rest = (episodes ?? []).slice(1) as Episode[];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <p className="text-sage-600 font-medium tracking-wide uppercase text-xs">
            A Green Dog Production
          </p>
          <h1 className="mt-3 text-5xl sm:text-6xl font-extrabold leading-tight">
            Real Vets. <span className="text-sage-600">Real Advice.</span>
            <br /> Real Pet Stories.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-sage-700">
            Honest conversations with practicing veterinarians on nutrition,
            surgery, behavior, and the questions every pet owner Googles at 2am.
          </p>
          <div className="mt-8 flex gap-3">
            <a href="#episodes" className="btn-primary">▶ Listen Now</a>
            <a href="#ask" className="btn-ghost">Ask a Vet</a>
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-sage-200/40 blur-3xl"
        />
      </section>

      {/* Featured Episode */}
      {featured && (
        <section className="mx-auto max-w-6xl px-6">
          <div className="card grid md:grid-cols-[2fr,3fr]">
            <div className="aspect-square md:aspect-auto bg-sage-100">
              {featured.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={featured.image_url} alt={featured.title} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="p-8 flex flex-col justify-center">
              <span className="text-xs uppercase tracking-wider text-sage-600 font-semibold">
                Latest Check-up
              </span>
              <h2 className="mt-2 text-3xl font-bold">{featured.title}</h2>
              <p className="mt-3 text-sage-700 line-clamp-3">{featured.description}</p>
              <Link href={`/episode/${featured.slug}`} className="btn-primary mt-6 self-start">
                ▶ Play Episode
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Filters */}
      <section className="mx-auto max-w-6xl px-6 mt-16" id="episodes">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold mr-4">Episodes</h2>
          {ANIMAL_FILTERS.map((f) => (
            <button key={f.key} className="btn-ghost text-xs py-1.5">
              {f.label}
            </button>
          ))}
          <span className="mx-2 h-6 w-px bg-sage-200" />
          {TOPICS.map((t) => (
            <button key={t} className="btn-ghost text-xs py-1.5">
              {t}
            </button>
          ))}
        </div>

        {/* Episode Grid (the "Clinic Floor") */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.length === 0 && !featured && (
            <p className="text-sage-600">No episodes published yet — check back soon.</p>
          )}
          {rest.map((ep) => (
            <Link key={ep.id} href={`/episode/${ep.slug}`} className="card group">
              <div className="aspect-square bg-sage-100 overflow-hidden">
                {ep.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ep.image_url}
                    alt={ep.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center text-6xl">🐾</div>
                )}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-lg leading-snug">{ep.title}</h3>
                <p className="text-sm text-sage-600 mt-1 line-clamp-2">
                  {ep.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Vet Directory */}
      <section className="mx-auto max-w-6xl px-6 mt-20" id="vets">
        <h2 className="text-2xl font-bold">Meet the Vets</h2>
        <div className="mt-6 grid sm:grid-cols-2 md:grid-cols-4 gap-6">
          {(vets ?? []).map((v: Vet) => (
            <div key={v.id} className="card p-5 text-center">
              <div className="mx-auto h-24 w-24 rounded-full bg-sage-100 overflow-hidden">
                {v.bio_photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.bio_photo_url} alt={v.name} className="h-full w-full object-cover" />
                )}
              </div>
              <h3 className="mt-3 font-semibold">{v.name}</h3>
              <p className="text-xs text-sage-600">{v.specialty}</p>
              <p className="text-xs text-sage-500 mt-1">{v.clinic_location}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ask a Vet */}
      <section className="mx-auto max-w-3xl px-6 mt-20" id="ask">
        <div className="card p-8">
          <h2 className="text-2xl font-bold">Ask a Vet</h2>
          <p className="text-sage-700 mt-1">
            Submit a question and we may answer it on a future episode.
          </p>
          <form action="/api/mailbag" method="post" className="mt-5 grid gap-3">
            <input
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              className="rounded-xl border border-sage-200 bg-white px-4 py-3"
            />
            <textarea
              name="question"
              required
              rows={4}
              placeholder="What's going on with your pet?"
              className="rounded-xl border border-sage-200 bg-white px-4 py-3"
            />
            <button className="btn-primary self-start">Submit Question</button>
          </form>
        </div>
      </section>
    </>
  );
}
