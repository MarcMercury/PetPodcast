import { NextResponse } from 'next/server';
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
  if (body.description) updates.description = body.description;
  if (body.spotify_url !== undefined) updates.spotify_url = body.spotify_url || null;

  const { error } = await supabaseAdmin
    .from('episodes').update(updates).eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, audio_url: updates.audio_url });
}
