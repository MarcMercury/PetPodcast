import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { transcribeAudio } from '@/lib/ai/openai';

const AUDIO_BUCKET = process.env.SUPABASE_BUCKET_AUDIO || 'pet-podcast-audio';

export const maxDuration = 300; // seconds — needed for long Whisper jobs (Vercel Pro)

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  // Find the audio asset for this episode (most recent).
  const { data: ep } = await supabaseAdmin
    .from('episodes').select('audio_url').eq('id', params.id).single();
  if (!ep?.audio_url) return NextResponse.json({ error: 'no audio uploaded' }, { status: 400 });

  // Re-list latest audio path from storage by listing the episode's folder.
  const { data: list } = await supabaseAdmin.storage.from(AUDIO_BUCKET).list(params.id);
  const file = list?.[0];
  if (!file) return NextResponse.json({ error: 'audio file not found in storage' }, { status: 404 });

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(AUDIO_BUCKET).download(`${params.id}/${file.name}`);
  if (dlErr || !blob) return NextResponse.json({ error: dlErr?.message || 'download failed' }, { status: 500 });

  try {
    const result = await transcribeAudio(blob, file.name);
    await supabaseAdmin
      .from('transcripts')
      .upsert({
        episode_id: params.id,
        raw_text: result.text,
        segments: result.segments,
        language: result.language
      }, { onConflict: 'episode_id' });

    return NextResponse.json({ text: result.text, segments: result.segments.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
