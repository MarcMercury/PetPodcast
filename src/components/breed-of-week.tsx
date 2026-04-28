// Home-page "Breeds of the Week" strip. Deterministic — one dog + one cat,
// rotating every Sunday evening (~7pm ET / 23:00 UTC). See getBreedsOfTheWeek.

import Link from 'next/link';
import { getBreedsOfTheWeek, type Breed } from '@/lib/breeds';

function BreedCard({ breed }: { breed: Breed }) {
  return (
    <Link
      href={`/breeds/${breed.species}/${breed.slug}`}
      className="card overflow-hidden group flex flex-col"
    >
      <div className="aspect-[4/3] bg-bone relative">
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
      <div className="p-6 md:p-8 flex flex-col flex-1">
        <h3 className="text-2xl md:text-3xl font-display font-bold leading-tight group-hover:text-sage-300 transition">
          {breed.name}
        </h3>
        {breed.temperament && (
          <p className="mt-3 text-sage-300 italic line-clamp-2">{breed.temperament}</p>
        )}
        {breed.description && (
          <p className="mt-3 text-sage-200 line-clamp-3 leading-relaxed">{breed.description}</p>
        )}
        <span className="mt-5 self-start btn-ghost">Read profile →</span>
      </div>
    </Link>
  );
}

export default async function BreedOfWeek() {
  const { dog, cat } = await getBreedsOfTheWeek();
  if (!dog && !cat) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 mt-20" id="breed-of-week">
      <p className="eyebrow">Breeds of the Week</p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {dog && <BreedCard breed={dog} />}
        {cat && <BreedCard breed={cat} />}
      </div>
    </section>
  );
}
