import { NextResponse } from 'next/server';
import { getAllBreeds, type Species } from '@/lib/breeds';

// Public, lightweight breed list — used by the admin episode form's
// breed picker. Cached upstream by getAllBreeds (24h ISR).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const species = url.searchParams.get('species');
  if (species !== 'dog' && species !== 'cat') {
    return NextResponse.json({ error: "species must be 'dog' or 'cat'" }, { status: 400 });
  }
  const breeds = await getAllBreeds(species as Species);
  return NextResponse.json({
    breeds: breeds.map((b) => ({ slug: b.slug, name: b.name }))
  });
}
