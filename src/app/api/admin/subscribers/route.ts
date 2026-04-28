import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST — admin manually adds a subscriber.
export async function POST(req: Request) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({} as any));
  const email = String(body.email ?? '').trim();
  const source = body.source ? String(body.source) : 'admin';

  if (!email || !EMAIL_RX.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('subscribers')
    .insert({ email: email.toLowerCase(), source });

  if (error && !/duplicate key|unique/i.test(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
