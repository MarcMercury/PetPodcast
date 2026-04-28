import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Returns a random mailbag question for the studio's wildcard generator.
// Pulls all submissions (the homepage "Ask a Vet" form writes to the same
// `mailbag` table) and picks one at random. Optional `?exclude=id1,id2,...`
// avoids repeats within a session.
export async function GET(req: Request) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const exclude = (url.searchParams.get('exclude') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const onlyOpen = url.searchParams.get('open') === '1';

  let q = supabaseAdmin
    .from('mailbag')
    .select('id,user_email,question,category,is_answered,created_at');

  if (onlyOpen) q = q.eq('is_answered', false);
  if (exclude.length) q = q.not('id', 'in', `(${exclude.join(',')})`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    return NextResponse.json({ entry: null, total: 0 });
  }

  const entry = data[Math.floor(Math.random() * data.length)];
  return NextResponse.json({ entry, total: data.length });
}
