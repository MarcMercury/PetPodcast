import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';

// PATCH — toggle subscribed/unsubscribed (sets unsubscribed_at).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({} as any));
  const updates: Record<string, unknown> = {};

  if (typeof body.unsubscribed === 'boolean') {
    updates.unsubscribed_at = body.unsubscribed ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updatable fields' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('subscribers')
    .update(updates)
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — hard-remove a subscriber.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { error } = await supabaseAdmin
    .from('subscribers')
    .delete()
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
