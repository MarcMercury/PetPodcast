import { getAllBreeds } from '@/lib/breeds';
import { BreedsBrowser } from './breeds-browser';

export const revalidate = 86400;

export const metadata = {
  title: 'Breeds — Petspective',
  description: 'A clinical-eye look at every dog and cat breed, with vet-grade context.'
};

export default async function BreedsIndex() {
  const [dogs, cats] = await Promise.all([getAllBreeds('dog'), getAllBreeds('cat')]);

  return (
    <article className="mx-auto max-w-6xl px-6 py-12">
      <p className="eyebrow">Petspective · Breed Library</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Breeds</h1>
      <p className="mt-3 max-w-2xl text-sage-200 leading-relaxed">
        A clinical-eye look at every dog and cat breed in our reference library.
        Sourced from The Dog API and The Cat API, with vet-grade context.
      </p>

      <BreedsBrowser dogs={dogs} cats={cats} />
    </article>
  );
}
