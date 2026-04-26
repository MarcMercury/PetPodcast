import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';

export async function POST(req: Request) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const { title, slug, description, season, episode_number, spotify_url } = body;
  if (!title || !slug) return NextResponse.json({ error: 'title & slug required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('episodes')
    .insert({
      title, slug, description, season, episode_number,
      spotify_url: spotify_url || null,
      status: 'draft',
      created_by: auth.user.id
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
