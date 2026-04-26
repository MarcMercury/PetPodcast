import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBreedBySlug, type Species } from '@/lib/breeds';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { Episode } from '@/lib/types';

export const revalidate = 86400;

type Params = { params: { species: string; slug: string } };

function isSpecies(s: string): s is Species {
  return s === 'dog' || s === 'cat';
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  if (!isSpecies(params.species)) return { title: 'Breed — Petspective' };
  const breed = await getBreedBySlug(params.species, params.slug);
  if (!breed) return { title: 'Breed — Petspective' };
  return {
    title: `${breed.name} — Petspective`,
    description: breed.description ?? `${breed.name} breed profile from Petspective.`,
    openGraph: {
      title: `${breed.name} — Petspective`,
      description: breed.description ?? '',
      images: breed.imageUrl ? [{ url: breed.imageUrl }] : undefined,
      type: 'article'
    }
  };
}

export default async function BreedDetailPage({ params }: Params) {
  if (!isSpecies(params.species)) notFound();
  const breed = await getBreedBySlug(params.species, params.slug);
  if (!breed) notFound();

  // Pull related episodes if any are tagged to this breed.
  const supabase = createSupabaseServer();
  const { data: relatedEpisodes } = await supabase
    .from('episodes')
    .select('*')
    .eq('status', 'published')
    .eq('breed_species', breed.species)
    .eq('breed_slug', breed.slug)
    .order('published_at', { ascending: false });

  const episodes = (relatedEpisodes ?? []) as Episode[];

  return (
    <article className="mx-auto max-w-5xl px-6 py-12">
      <p className="eyebrow">
        <Link href="/breeds" className="hover:text-cream underline-offset-4 hover:underline">
          Breeds
        </Link>
        {' · '}
        <Link
          href={`/breeds#${breed.species === 'dog' ? 'dogs' : 'cats'}`}
          className="hover:text-cream underline-offset-4 hover:underline"
        >
          {breed.species === 'dog' ? 'Dogs' : 'Cats'}
        </Link>
      </p>
      <header className="mt-3 grid md:grid-cols-[2fr,3fr] gap-8 items-start">
        <div className="aspect-square rounded-2xl bg-bone overflow-hidden ring-1 ring-sage-700">
          {breed.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={breed.imageUrl} alt={breed.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-7xl">
              {breed.species === 'dog' ? '🐕' : '🐈'}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-4xl font-display font-bold leading-tight tracking-tight">{breed.name}</h1>
          {breed.temperament && (
            <p className="mt-2 text-sage-300 italic">{breed.temperament}</p>
          )}
          {breed.description && (
            <p className="mt-5 text-sage-100 leading-relaxed">{breed.description}</p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            {breed.origin && <Stat label="Origin" value={breed.origin} />}
            {breed.lifeSpan && <Stat label="Life span" value={`${breed.lifeSpan} yrs`} />}
            {breed.weight && <Stat label="Weight (lbs)" value={breed.weight} />}
            {breed.height && <Stat label="Height (in)" value={breed.height} />}
            {breed.breedGroup && <Stat label="Group" value={breed.breedGroup} />}
          </dl>
          {breed.wikipediaUrl && (
            <p className="mt-5 text-xs">
              <a
                href={breed.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sage-300 underline underline-offset-4 hover:text-cream"
              >
                Wikipedia →
              </a>
            </p>
          )}
        </div>
      </header>

      {episodes.length > 0 && (
        <section className="mt-12">
          <p className="eyebrow">Featured on Petspective</p>
          <h2 className="mt-2 text-2xl font-display font-bold tracking-tight">
            Episodes featuring the {breed.name}
          </h2>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {episodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/episode/${ep.slug}`}
                className="card p-5 flex gap-4 group hover:shadow-md transition"
              >
                <div className="w-20 h-20 rounded-lg bg-bone overflow-hidden shrink-0">
                  {ep.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ep.image_url} alt={ep.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="eyebrow">
                    {ep.season ? `S${ep.season} · ` : ''}
                    {ep.episode_number ? `Ep ${ep.episode_number}` : 'Episode'}
                  </p>
                  <h3 className="mt-1 font-display font-bold leading-snug group-hover:text-sage-300 transition line-clamp-2 text-cream">
                    {ep.title}
                  </h3>
                  <p className="mt-1 text-xs text-sage-200 line-clamp-2">{ep.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 text-xs text-sage-400">
        Source:{' '}
        <a
          href={breed.species === 'dog' ? 'https://thedogapi.com/' : 'https://thecatapi.com/'}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          {breed.species === 'dog' ? 'The Dog API' : 'The Cat API'}
        </a>
        . Always consult your veterinarian for health and behavior guidance specific to your pet.
      </p>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-brand text-sage-300 font-semibold font-deck">{label}</dt>
      <dd className="mt-1 text-cream">{value}</dd>
    </div>
  );
}
