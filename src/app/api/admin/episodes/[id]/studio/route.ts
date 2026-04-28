// GET  → load project state + signed URLs the studio needs.
// PUT  → upsert cuts / chapters / intro+outro paths.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { BUCKETS, assertPetBucket } from '@/lib/isolation';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || BUCKETS.audio;
assertPetBucket(AUDIO_BUCKET);

const SIGNED_URL_TTL = 60 * 60 * 6; // 6h — long enough for an editing session.

async function sign(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  return data?.signedUrl ?? null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const [{ data: project }, { data: episode }, { data: transcript }, { data: list }] =
    await Promise.all([
      supabaseAdmin.from('studio_projects').select('*').eq('episode_id', params.id).maybeSingle(),
      supabaseAdmin.from('episodes').select('id, title, audio_url').eq('id', params.id).single(),
      supabaseAdmin
        .from('transcripts')
        .select('raw_text, segments, words, language')
        .eq('episode_id', params.id)
        .maybeSingle(),
      supabaseAdmin.storage.from(AUDIO_BUCKET).list(params.id)
    ]);

  if (!episode) return NextResponse.json({ error: 'episode not found' }, { status: 404 });

  // The "source" audio path = newest non-final, non-polished file in the episode folder,
  // unless the project has explicitly polished or rendered something.
  const sourceFile = (list ?? []).find(
    (f) => !f.name.startsWith('final.') && !f.name.startsWith('polished.')
  );
  const sourcePath = sourceFile ? `${params.id}/${sourceFile.name}` : null;

  const [sourceUrl, polishedUrl, finalUrl, introUrl, outroUrl] = await Promise.all([
    sign(sourcePath),
    sign(project?.polished_audio_path),
    sign(project?.final_audio_path),
    sign(project?.intro_path),
    sign(project?.outro_path)
  ]);

  return NextResponse.json({
    episode,
    transcript: transcript ?? null,
    project: project ?? {
      episode_id: params.id,
      cuts: [],
      chapters: [],
      intro_path: null,
      outro_path: null,
      auphonic_uuid: null,
      auphonic_status: null,
      polished_audio_path: null,
      final_audio_path: null
    },
    urls: {
      source: sourceUrl,
      polished: polishedUrl,
      final: finalUrl,
      intro: introUrl,
      outro: outroUrl
    },
    paths: {
      source: sourcePath
    }
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const updates: Record<string, unknown> = { episode_id: params.id };
  if (Array.isArray(body.cuts)) updates.cuts = body.cuts;
  if (Array.isArray(body.chapters)) updates.chapters = body.chapters;
  if (body.intro_path !== undefined) updates.intro_path = body.intro_path || null;
  if (body.outro_path !== undefined) updates.outro_path = body.outro_path || null;

  const { error } = await supabaseAdmin
    .from('studio_projects')
    .upsert(updates, { onConflict: 'episode_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
