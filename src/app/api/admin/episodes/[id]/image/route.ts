import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { generateImages } from '@/lib/ai/openai';

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { prompt, count = 4 } = await req.json();
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });

  try {
    const urls = await generateImages(prompt, Math.min(count, 4));

    // Persist as thumbnail_option assets so we can re-display.
    await supabaseAdmin.from('assets').insert(
      urls.map((u) => ({
        episode_id: params.id,
        kind: 'thumbnail_option',
        storage_path: u, // remote URL until selection
        public_url: u,
        prompt
      }))
    );

    return NextResponse.json({ urls });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
