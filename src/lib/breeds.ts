// Wraps The Dog API and The Cat API behind a single, normalized interface.
// Each request is cached for 24h via Next ISR — breed metadata barely changes.

export type Species = 'dog' | 'cat';

export interface Breed {
  species: Species;
  id: string; // upstream id (string for dog ('1'), slug-like for cat ('abys'))
  slug: string; // url-safe slug we always control
  name: string;
  temperament: string | null;
  origin: string | null;
  lifeSpan: string | null;
  description: string | null;
  weight: string | null; // imperial
  height: string | null; // imperial (dogs only)
  imageUrl: string | null;
  wikipediaUrl: string | null;
  breedGroup: string | null;
}

interface DogApiBreed {
  id: number | string;
  name: string;
  temperament?: string;
  origin?: string;
  life_span?: string;
  description?: string;
  bred_for?: string;
  breed_group?: string;
  weight?: { imperial?: string; metric?: string };
  height?: { imperial?: string; metric?: string };
  image?: { url?: string };
  reference_image_id?: string;
}

interface CatApiBreed {
  id: string;
  name: string;
  temperament?: string;
  origin?: string;
  life_span?: string;
  description?: string;
  alt_names?: string;
  weight?: { imperial?: string; metric?: string };
  image?: { url?: string };
  reference_image_id?: string;
  wikipedia_url?: string;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function dogImageUrl(b: DogApiBreed): string | null {
  if (b.image?.url) return b.image.url;
  if (b.reference_image_id) {
    return `https://cdn2.thedogapi.com/images/${b.reference_image_id}.jpg`;
  }
  return null;
}

function catImageUrl(b: CatApiBreed): string | null {
  if (b.image?.url) return b.image.url;
  if (b.reference_image_id) {
    return `https://cdn2.thecatapi.com/images/${b.reference_image_id}.jpg`;
  }
  return null;
}

function normalizeDog(b: DogApiBreed): Breed {
  return {
    species: 'dog',
    id: String(b.id),
    slug: slugify(b.name),
    name: b.name,
    temperament: b.temperament ?? null,
    origin: b.origin ?? null,
    lifeSpan: b.life_span ?? null,
    description: b.description ?? b.bred_for ?? null,
    weight: b.weight?.imperial ?? null,
    height: b.height?.imperial ?? null,
    imageUrl: dogImageUrl(b),
    wikipediaUrl: null,
    breedGroup: b.breed_group ?? null
  };
}

function normalizeCat(b: CatApiBreed): Breed {
  return {
    species: 'cat',
    id: b.id,
    slug: slugify(b.name),
    name: b.name,
    temperament: b.temperament ?? null,
    origin: b.origin ?? null,
    lifeSpan: b.life_span ?? null,
    description: b.description ?? null,
    weight: b.weight?.imperial ?? null,
    height: null,
    imageUrl: catImageUrl(b),
    wikipediaUrl: b.wikipedia_url ?? null,
    breedGroup: null
  };
}

const DOG_BASE = 'https://api.thedogapi.com/v1';
const CAT_BASE = 'https://api.thecatapi.com/v1';
const REVALIDATE = 60 * 60 * 24; // 24h

function dogHeaders(): HeadersInit {
  const key = process.env.THE_DOG_API_KEY;
  return key ? { 'x-api-key': key } : {};
}

function catHeaders(): HeadersInit {
  const key = process.env.THE_CAT_API_KEY;
  return key ? { 'x-api-key': key } : {};
}

export async function getAllBreeds(species: Species): Promise<Breed[]> {
  const isDog = species === 'dog';
  const url = `${isDog ? DOG_BASE : CAT_BASE}/breeds`;
  const headers = isDog ? dogHeaders() : catHeaders();
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: REVALIDATE, tags: [`breeds-${species}`] }
    });
    if (!res.ok) return [];
    const json = (await res.json()) as DogApiBreed[] | CatApiBreed[];
    if (isDog) return (json as DogApiBreed[]).map(normalizeDog).sort((a, b) => a.name.localeCompare(b.name));
    return (json as CatApiBreed[]).map(normalizeCat).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function getBreedBySlug(species: Species, slug: string): Promise<Breed | null> {
  const all = await getAllBreeds(species);
  return all.find((b) => b.slug === slug) ?? null;
}

// Deterministic "breeds of the week" — one dog + one cat, same for everyone,
// rotating every Sunday evening (23:00 UTC ≈ 6–7pm US Eastern). The epoch is a
// known Sunday at 23:00 UTC; the week index advances at that boundary.
const ROTATION_EPOCH_MS = Date.UTC(2024, 0, 7, 23, 0, 0); // Sun 2024-01-07 23:00 UTC
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getRotationWeekIndex(now: Date = new Date()): number {
  return Math.floor((now.getTime() - ROTATION_EPOCH_MS) / WEEK_MS);
}

export async function getBreedOfTheWeek(species: Species): Promise<Breed | null> {
  const all = await getAllBreeds(species);
  if (all.length === 0) return null;
  const week = getRotationWeekIndex();
  // Offset cat index so dog and cat don't cycle in lockstep.
  const offset = species === 'cat' ? Math.floor(all.length / 3) : 0;
  const idx = ((week + offset) % all.length + all.length) % all.length;
  return all[idx];
}

export async function getBreedsOfTheWeek(): Promise<{ dog: Breed | null; cat: Breed | null }> {
  const [dog, cat] = await Promise.all([getBreedOfTheWeek('dog'), getBreedOfTheWeek('cat')]);
  return { dog, cat };
}
