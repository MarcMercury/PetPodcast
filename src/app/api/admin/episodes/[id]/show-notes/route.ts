import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { generateShowNotes } from '@/lib/ai/gemini';

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { data: t } = await supabaseAdmin
    .from('transcripts')
    .select('raw_text, segments')
    .eq('episode_id', params.id)
    .single();

  if (!t?.raw_text) return NextResponse.json({ error: 'no transcript yet' }, { status: 400 });

  const segHint = (t.segments as any[])
    ?.slice(0, 40)
    .map((s) => `[${s.start}] ${s.text.slice(0, 100)}`)
    .join('\n');

  try {
    const notes = await generateShowNotes(t.raw_text, segHint);
    await supabaseAdmin.from('show_notes').upsert(
      {
        episode_id: params.id,
        summary: notes.summary,
        key_takeaways: notes.key_takeaways,
        chapters: notes.chapters,
        seo_description: notes.seo_description,
        generated_by: 'gemini-1.5-pro'
      },
      { onConflict: 'episode_id' }
    );
    return NextResponse.json(notes);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
