'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Breed } from '@/lib/breeds';

type Species = 'dog' | 'cat';

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
        <h3 className="font-display font-bold text-base leading-tight group-hover:text-sage-300 transition text-cream">
          {b.name}
        </h3>
        {b.origin && <p className="mt-1 text-xs text-sage-300">{b.origin}</p>}
      </div>
    </Link>
  );
}

export function BreedsBrowser({ dogs, cats }: { dogs: Breed[]; cats: Breed[] }) {
  const [species, setSpecies] = useState<Species>('dog');
  const [query, setQuery] = useState('');

  const active = species === 'dog' ? dogs : cats;
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return active;
    return active.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.origin?.toLowerCase().includes(q) ?? false)
    );
  }, [active, q]);

  const tabBase =
    'px-4 py-2 rounded-full text-sm font-medium transition border';
  const tabActive = 'bg-sage-300 text-ink border-sage-300';
  const tabIdle =
    'bg-transparent text-sage-200 border-sage-700 hover:border-sage-400';

  return (
    <div className="mt-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div role="tablist" aria-label="Species" className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={species === 'dog'}
            onClick={() => setSpecies('dog')}
            className={`${tabBase} ${species === 'dog' ? tabActive : tabIdle}`}
          >
            Dogs <span className="opacity-70">· {dogs.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={species === 'cat'}
            onClick={() => setSpecies('cat')}
            className={`${tabBase} ${species === 'cat' ? tabActive : tabIdle}`}
          >
            Cats <span className="opacity-70">· {cats.length}</span>
          </button>
        </div>

        <div className="relative sm:w-80">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${species === 'dog' ? 'dog' : 'cat'} breeds…`}
            className="w-full rounded-full bg-bone/5 border border-sage-700 focus:border-sage-300 focus:outline-none px-4 py-2 text-sm text-cream placeholder:text-sage-500"
            aria-label="Search breeds"
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-sage-400">
        {filtered.length} {species === 'dog' ? 'dog' : 'cat'} breed
        {filtered.length === 1 ? '' : 's'}
        {q ? ` matching “${query}”` : ''}
      </p>

      <section className="mt-4">
        {active.length === 0 ? (
          <p className="text-sage-300">Breed library temporarily unavailable.</p>
        ) : filtered.length === 0 ? (
          <p className="text-sage-300">No breeds match your search.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filtered.map((b) => (
              <BreedCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
