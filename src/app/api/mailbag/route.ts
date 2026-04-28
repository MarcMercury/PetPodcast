import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Public endpoint — accepts mailbag submissions from the homepage form.
// Submissions are one-way: questions feed the on-air Wildcard generator.
// We don't collect email and don't reply individually.
export async function POST(req: Request) {
  const ct = req.headers.get('content-type') || '';
  let question = '';

  if (ct.includes('application/json')) {
    const j = await req.json();
    question = j.question;
  } else {
    const f = await req.formData();
    question = String(f.get('question') ?? '');
  }

  if (!question) {
    return NextResponse.json({ error: 'question required' }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: 'question too long' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('mailbag')
    .insert({ question });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Redirect back for plain form submissions.
  if (!ct.includes('application/json')) {
    return NextResponse.redirect(new URL('/?submitted=1', req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
