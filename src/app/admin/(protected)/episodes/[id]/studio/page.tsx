// Studio (recording / editing console) — server entry point.
// Loads everything the client editor needs in one shot.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import StudioClient from './studio-client';

export const dynamic = 'force-dynamic';

export default async function StudioPage({ params }: { params: { id: string } }) {
  const { data: ep } = await supabaseAdmin
    .from('episodes')
    .select('id, slug, title, status, audio_url')
    .eq('id', params.id)
    .maybeSingle();
  if (!ep) notFound();

  // Fetch the studio bundle through our own API so the page and the client
  // share the same code path.
  const h = headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host');
  const cookie = h.get('cookie') ?? '';
  const res = await fetch(`${proto}://${host}/api/admin/episodes/${params.id}/studio`, {
    headers: { cookie },
    cache: 'no-store'
  });
  const initial = res.ok ? await res.json() : null;

  const audioBucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AUDIO || 'pet-podcast-audio';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-sage-500">Studio</p>
        <h1 className="font-display text-3xl font-bold">{ep.title}</h1>
        <p className="mt-1 text-sm text-sage-600">
          Trim, mark chapters, polish loudness, and render a publish-ready MP3 — all in your browser.
        </p>
      </div>
      <StudioClient
        episodeId={ep.id}
        episodeTitle={ep.title}
        audioBucket={audioBucket}
        initial={initial}
      />
    </div>
  );
}
