import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { BUCKETS, assertPetBucket } from '@/lib/isolation';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || BUCKETS.audio;
assertPetBucket(AUDIO_BUCKET);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.audio_storage_path) {
    // Generate a signed URL (audio bucket is private).
    const { data: signed } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET)
      .createSignedUrl(body.audio_storage_path, 60 * 60 * 24 * 365);
    updates.audio_url = signed?.signedUrl ?? null;
  }
  if (body.status) {
    updates.status = body.status;
    if (body.status === 'published') updates.published_at = new Date().toISOString();
  }
  if (body.title) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.season !== undefined) {
    updates.season = body.season === null || body.season === '' ? null : Number(body.season);
  }
  if (body.episode_number !== undefined) {
    updates.episode_number =
      body.episode_number === null || body.episode_number === '' ? null : Number(body.episode_number);
  }
  if (body.spotify_url !== undefined) updates.spotify_url = body.spotify_url || null;
  if (body.breed_species !== undefined) {
    const s = body.breed_species;
    updates.breed_species = s === 'dog' || s === 'cat' ? s : null;
    if (updates.breed_species === null) updates.breed_slug = null;
  }
  if (body.breed_slug !== undefined) {
    updates.breed_slug = body.breed_slug || null;
  }

  const { error } = await supabaseAdmin
    .from('episodes').update(updates).eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bust any Next data cache so the listener feed reflects edits immediately.
  const { data: ep } = await supabaseAdmin
    .from('episodes').select('slug').eq('id', params.id).maybeSingle();
  revalidatePath('/');
  revalidatePath('/episodes');
  revalidatePath('/feed.xml');
  if (ep?.slug) revalidatePath(`/episode/${ep.slug}`);

  return NextResponse.json({ ok: true, audio_url: updates.audio_url });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { data: ep } = await supabaseAdmin
    .from('episodes').select('slug').eq('id', params.id).maybeSingle();

  const { error } = await supabaseAdmin
    .from('episodes')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath('/');
  revalidatePath('/episodes');
  revalidatePath('/feed.xml');
  if (ep?.slug) revalidatePath(`/episode/${ep.slug}`);

  return NextResponse.json({ ok: true });
}
