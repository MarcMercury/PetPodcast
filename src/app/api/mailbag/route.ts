import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Public endpoint — accepts mailbag submissions from the homepage form.
export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let email = '', question = '';

  if (ct.includes('application/json')) {
    const j = await req.json();
    email = j.email; question = j.question;
  } else {
    const f = await req.formData();
    email = String(f.get('email') ?? '');
    question = String(f.get('question') ?? '');
  }

  if (!email || !question) {
    return NextResponse.json({ error: 'email and question required' }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: 'question too long' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('mailbag')
    .insert({ user_email: email, question });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Redirect back for plain form submissions.
  if (!ct.includes('application/json')) {
    return NextResponse.redirect(new URL('/?submitted=1', req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
