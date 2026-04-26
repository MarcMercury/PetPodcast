import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';

export async function POST(req: Request) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const {
    title, slug, description, season, episode_number, spotify_url,
    breed_species, breed_slug
  } = body;
  if (!title || !slug) return NextResponse.json({ error: 'title & slug required' }, { status: 400 });

  const species = breed_species === 'dog' || breed_species === 'cat' ? breed_species : null;
  const { data, error } = await supabaseAdmin
    .from('episodes')
    .insert({
      title, slug, description, season, episode_number,
      spotify_url: spotify_url || null,
      breed_species: species,
      breed_slug: species && breed_slug ? breed_slug : null,
      status: 'draft',
      created_by: auth.user.id
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
