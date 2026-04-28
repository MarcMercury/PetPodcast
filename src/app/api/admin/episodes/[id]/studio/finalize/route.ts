// Finalize: client did the in-browser ffmpeg.wasm render and uploaded the
// resulting MP3 directly to Supabase storage. This route records the path on
// the studio project and (optionally) promotes it to the episode's audio_url.
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { BUCKETS, assertPetBucket } from '@/lib/isolation';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || BUCKETS.audio;
assertPetBucket(AUDIO_BUCKET);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const path: string | undefined = body.final_audio_path;
  const promote: boolean = !!body.promote;
  if (!path) return NextResponse.json({ error: 'final_audio_path required' }, { status: 400 });
  if (!path.startsWith(`${params.id}/`)) {
    return NextResponse.json({ error: 'path must live under the episode folder' }, { status: 400 });
  }

  await supabaseAdmin
    .from('studio_projects')
    .upsert({ episode_id: params.id, final_audio_path: path }, { onConflict: 'episode_id' });

  let audio_url: string | null = null;
  if (promote) {
    const { data: signed } = await supabaseAdmin.storage
      .from(AUDIO_BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
    audio_url = signed?.signedUrl ?? null;
    await supabaseAdmin.from('episodes').update({ audio_url }).eq('id', params.id);

    const { data: ep } = await supabaseAdmin
      .from('episodes').select('slug').eq('id', params.id).maybeSingle();
    revalidatePath('/');
    revalidatePath('/episodes');
    revalidatePath('/feed.xml');
    if (ep?.slug) revalidatePath(`/episode/${ep.slug}`);
  }

  return NextResponse.json({ ok: true, audio_url });
}
