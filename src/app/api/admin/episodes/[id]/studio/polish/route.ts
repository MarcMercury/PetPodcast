// Auphonic polish:
//   POST → submit current source audio to Auphonic, store uuid.
//   GET  → poll status; when done, download the result and store in our bucket.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { BUCKETS, assertPetBucket } from '@/lib/isolation';
import { submitProduction, getProduction, mapStatus } from '@/lib/auphonic';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || BUCKETS.audio;
assertPetBucket(AUDIO_BUCKET);

export const maxDuration = 300;

async function findSourcePath(episodeId: string): Promise<string | null> {
  const { data: list } = await supabaseAdmin.storage.from(AUDIO_BUCKET).list(episodeId);
  const f = (list ?? []).find(
    (x) => !x.name.startsWith('final.') && !x.name.startsWith('polished.')
  );
  return f ? `${episodeId}/${f.name}` : null;
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const sourcePath = await findSourcePath(params.id);
  if (!sourcePath) return NextResponse.json({ error: 'no source audio uploaded' }, { status: 400 });

  // Auphonic needs a URL it can fetch — give it a short-lived signed URL.
  const { data: signed } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET).createSignedUrl(sourcePath, 60 * 60 * 4);
  if (!signed?.signedUrl) return NextResponse.json({ error: 'sign failed' }, { status: 500 });

  const { data: ep } = await supabaseAdmin
    .from('episodes').select('title').eq('id', params.id).single();

  try {
    const uuid = await submitProduction(signed.signedUrl, ep?.title || `Episode ${params.id}`);
    await supabaseAdmin.from('studio_projects').upsert(
      {
        episode_id: params.id,
        auphonic_uuid: uuid,
        auphonic_status: 'queued',
        polished_audio_path: null
      },
      { onConflict: 'episode_id' }
    );
    return NextResponse.json({ uuid, status: 'queued' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { data: project } = await supabaseAdmin
    .from('studio_projects').select('auphonic_uuid, polished_audio_path').eq('episode_id', params.id).maybeSingle();
  if (!project?.auphonic_uuid) {
    return NextResponse.json({ status: null });
  }

  try {
    const prod = await getProduction(project.auphonic_uuid);
    const status = mapStatus(prod.status);

    // If done and we haven't already imported the result, download + store it.
    let polishedUrl: string | null = null;
    let polishedPath: string | null = project.polished_audio_path ?? null;
    if (status === 'done' && !polishedPath) {
      const out = prod.output_files.find((o) => o.format === 'mp3');
      if (out?.download_url) {
        const dl = await fetch(out.download_url, {
          headers: { Authorization: `Bearer ${process.env.AUPHONIC_API_KEY}` }
        });
        if (!dl.ok) throw new Error(`Auphonic download failed: ${dl.status}`);
        const buf = await dl.arrayBuffer();
        const path = `${params.id}/polished.mp3`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(AUDIO_BUCKET).upload(path, new Blob([buf], { type: 'audio/mpeg' }), { upsert: true });
        if (upErr) throw new Error(upErr.message);
        polishedPath = path;
      }
    }

    await supabaseAdmin.from('studio_projects').upsert(
      {
        episode_id: params.id,
        auphonic_status: status,
        polished_audio_path: polishedPath
      },
      { onConflict: 'episode_id' }
    );

    if (polishedPath) {
      const { data: signed } = await supabaseAdmin.storage
        .from(AUDIO_BUCKET).createSignedUrl(polishedPath, 60 * 60 * 6);
      polishedUrl = signed?.signedUrl ?? null;
    }

    return NextResponse.json({
      status,
      status_string: prod.status_string,
      polished_url: polishedUrl
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
