import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Public endpoint — listener email opt-in for "new episode drop" updates.
// Service-role insert only; the table has no anon-write policy by design.
// Sending is out of scope for now (auth email goes through Supabase SMTP;
// transactional provider TBD per repo conventions — do not assume Resend).

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let email = '';
  let source = 'home';

  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({} as any));
    email = String(j.email ?? '').trim();
    if (j.source) source = String(j.source);
  } else {
    const f = await req.formData();
    email = String(f.get('email') ?? '').trim();
    const s = f.get('source');
    if (s) source = String(s);
  }

  if (!email || !EMAIL_RX.test(email) || email.length > 254) {
    if (!ct.includes('application/json')) {
      return NextResponse.redirect(new URL('/?subscribed=invalid#subscribe', req.url), 303);
    }
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  const ua = (req.headers.get('user-agent') ?? '').slice(0, 500);

  // Upsert by lowercased email (the unique index is on lower(email)).
  // We do an insert and swallow the unique-violation so a re-subscribe is idempotent.
  const { error } = await supabaseAdmin
    .from('subscribers')
    .insert({ email: email.toLowerCase(), source, user_agent: ua });

  if (error && !/duplicate key|unique/i.test(error.message)) {
    if (!ct.includes('application/json')) {
      return NextResponse.redirect(new URL('/?subscribed=error#subscribe', req.url), 303);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!ct.includes('application/json')) {
    return NextResponse.redirect(new URL('/?subscribed=1#subscribe', req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
