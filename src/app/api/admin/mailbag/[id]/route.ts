import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';

// PATCH and DELETE for mailbag entries — creator-only.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.is_answered === 'boolean') updates.is_answered = body.is_answered;
  if (typeof body.category === 'string') updates.category = body.category || null;
  if (typeof body.answered_episode_id === 'string' || body.answered_episode_id === null) {
    updates.answered_episode_id = body.answered_episode_id || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('mailbag')
    .update(updates)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { error } = await supabaseAdmin
    .from('mailbag')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
