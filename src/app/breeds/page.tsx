import Link from 'next/link';
import { getAllBreeds, type Breed } from '@/lib/breeds';

export const revalidate = 86400;

export const metadata = {
  title: 'Breeds — Petspective',
  description: 'A clinical-eye look at every dog and cat breed, with vet-grade context.'
};

function BreedCard({ b }: { b: Breed }) {
  return (
    <Link
      href={`/breeds/${b.species}/${b.slug}`}
      className="card overflow-hidden group flex flex-col"
    >
      <div className="aspect-square bg-bone overflow-hidden">
        {b.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.imageUrl}
            alt={b.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-5xl">
            {b.species === 'dog' ? '🐕' : '🐈'}
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-base leading-tight group-hover:text-sage-700 transition">
          {b.name}
        </h3>
        {b.origin && <p className="mt-1 text-xs text-sage-600">{b.origin}</p>}
      </div>
    </Link>
  );
}

export default async function BreedsIndex() {
  const [dogs, cats] = await Promise.all([getAllBreeds('dog'), getAllBreeds('cat')]);

  return (
    <article className="mx-auto max-w-6xl px-6 py-12">
      <p className="eyebrow">Petspective · Breed Library</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Breeds</h1>
      <p className="mt-3 max-w-2xl text-sage-800 leading-relaxed">
        A clinical-eye look at every dog and cat breed in our reference library.
        Sourced from The Dog API and The Cat API, with vet-grade context.
      </p>

      <section className="mt-12" id="dogs">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Dogs <span className="text-sage-500 text-base font-normal">· {dogs.length} breeds</span>
          </h2>
        </div>
        {dogs.length === 0 ? (
          <p className="text-sage-700">Breed library temporarily unavailable.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {dogs.map((b) => <BreedCard key={b.id} b={b} />)}
          </div>
        )}
      </section>

      <section className="mt-16" id="cats">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-2xl font-extrabold tracking-tight">
            Cats <span className="text-sage-500 text-base font-normal">· {cats.length} breeds</span>
          </h2>
        </div>
        {cats.length === 0 ? (
          <p className="text-sage-700">Breed library temporarily unavailable.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {cats.map((b) => <BreedCard key={b.id} b={b} />)}
          </div>
        )}
      </section>
    </article>
  );
}
