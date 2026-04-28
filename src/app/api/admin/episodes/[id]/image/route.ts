import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { generateImages } from '@/lib/ai/openai';
import { buildCoverPrompt, isWrappedCoverPrompt } from '@/lib/ai/cover-style';

export const maxDuration = 120;

// POST /api/admin/episodes/:id/image
//
// Body shapes:
//   { count?: number, subject: string, species?: string, topic?: string }
//     → builds a brand-consistent cover prompt from the subject phrase.
//   { count?: number, prompt: string }
//     → wraps freeform prompt in the house style so every cover stays
//       visually consistent. Already-wrapped prompts are reused verbatim.
//   { count?: number, auto: true }
//     → derives subject from the episode's title + show-notes summary.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || 4, 1), 4);

  let finalPrompt: string | null = null;
  let logSubject = '';

  try {
    if (body.auto === true) {
      const [{ data: ep }, { data: notes }] = await Promise.all([
        supabaseAdmin
          .from('episodes')
          .select('title, description, breed_species, animal_types')
          .eq('id', params.id)
          .maybeSingle(),
        supabaseAdmin
          .from('show_notes')
          .select('summary, suggested_image_prompt')
          .eq('episode_id', params.id)
          .maybeSingle()
      ]);

      if (!ep) return NextResponse.json({ error: 'episode not found' }, { status: 404 });

      const suggested = notes?.suggested_image_prompt?.trim();
      const subject =
        suggested && suggested.length > 12
          ? suggested
          : `${ep.title}${notes?.summary ? ` — ${String(notes.summary).slice(0, 220)}` : ''}`;

      finalPrompt = buildCoverPrompt({
        subject,
        species:
          ep.breed_species ??
          (Array.isArray(ep.animal_types) ? ep.animal_types[0] : null),
        topic: ep.description ?? null
      });
      logSubject = subject;
    } else if (typeof body.subject === 'string' && body.subject.trim()) {
      finalPrompt = buildCoverPrompt({
        subject: body.subject,
        species: body.species ?? null,
        topic: body.topic ?? null
      });
      logSubject = body.subject;
    } else if (typeof body.prompt === 'string' && body.prompt.trim()) {
      finalPrompt = isWrappedCoverPrompt(body.prompt)
        ? body.prompt
        : buildCoverPrompt({ subject: body.prompt });
      logSubject = body.prompt;
    } else {
      return NextResponse.json(
        { error: 'subject, prompt, or auto=true required' },
        { status: 400 }
      );
    }

    const urls = await generateImages(finalPrompt as string, count);

    await supabaseAdmin.from('assets').insert(
      urls.map((u) => ({
        episode_id: params.id,
        kind: 'thumbnail_option',
        storage_path: u,
        public_url: u,
        prompt: logSubject.slice(0, 1000)
      }))
    );

    return NextResponse.json({ urls, prompt: finalPrompt, subject: logSubject });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
