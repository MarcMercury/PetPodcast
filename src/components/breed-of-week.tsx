// Home-page "Breed of the Week" strip. Deterministic — rotates Monday-ish
// (we use ISO week number for simplicity), alternates dog/cat by week parity.

import Link from 'next/link';
import { getBreedOfTheWeek } from '@/lib/breeds';

export default async function BreedOfWeek() {
  const breed = await getBreedOfTheWeek();
  if (!breed) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 mt-20" id="breed-of-week">
      <p className="eyebrow">Breed of the Week</p>
      <Link
        href={`/breeds/${breed.species}/${breed.slug}`}
        className="mt-4 card grid md:grid-cols-[3fr,4fr] overflow-hidden group"
      >
        <div className="aspect-square md:aspect-auto bg-bone relative">
          {breed.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={breed.imageUrl}
              alt={breed.name}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition"
            />
          ) : (
            <div className="w-full h-full grid place-items-center text-7xl">
              {breed.species === 'dog' ? '🐕' : '🐈'}
            </div>
          )}
          <span className="absolute top-4 left-4 chip bg-ink/80 text-sage-200 backdrop-blur">
            {breed.species === 'dog' ? 'Dog' : 'Cat'}
          </span>
        </div>
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold leading-tight group-hover:text-sage-300 transition">
            {breed.name}
          </h2>
          {breed.temperament && (
            <p className="mt-3 text-sage-300 italic line-clamp-2">{breed.temperament}</p>
          )}
          {breed.description && (
            <p className="mt-4 text-sage-200 line-clamp-3 leading-relaxed">{breed.description}</p>
          )}
          <span className="mt-6 self-start btn-ghost">Read profile →</span>
        </div>
      </Link>
    </section>
  );
}
