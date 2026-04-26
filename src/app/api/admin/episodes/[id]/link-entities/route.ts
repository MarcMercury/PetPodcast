import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { extractEntityLinks } from '@/lib/ai/gemini';

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { data: t } = await supabaseAdmin
    .from('transcripts')
    .select('raw_text')
    .eq('episode_id', params.id)
    .single();

  if (!t?.raw_text) {
    return NextResponse.json({ error: 'no transcript yet' }, { status: 400 });
  }

  try {
    const links = await extractEntityLinks(t.raw_text);
    await supabaseAdmin
      .from('transcripts')
      .update({ entity_links: links })
      .eq('episode_id', params.id);

    return NextResponse.json({ entity_links: links, count: links.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
