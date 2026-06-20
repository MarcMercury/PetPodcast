import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { BUCKETS, assertPetBucket } from '@/lib/isolation';

const IMG_BUCKET = process.env.SUPABASE_BUCKET_IMAGES || BUCKETS.images;
assertPetBucket(IMG_BUCKET);

// Only allow image fetches from known AI image CDNs and our own storage.
const ALLOWED_IMAGE_HOSTS = [
  'oaidalleapiprodscus.blob.core.windows.net',
  'dalleprodsec.blob.core.windows.net',
  'generativelanguage.googleapis.com',
  'storage.googleapis.com',
  new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').hostname,
];

function isAllowedImageUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_IMAGE_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
  if (!isAllowedImageUrl(url)) {
    return NextResponse.json({ error: 'url must be HTTPS from a trusted image host' }, { status: 400 });
  }

  try {
    // Download remote AI image, then re-upload to our Supabase bucket for permanence.
    const r = await fetch(url);
    if (!r.ok) throw new Error('failed to fetch source image');

    // Verify the response is actually an image before buffering.
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) {
      return NextResponse.json(
        { error: `Expected image content-type, got "${ct}"` },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await r.arrayBuffer());
    const path = `${params.id}/cover-${Date.now()}.png`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(IMG_BUCKET)
      .upload(path, buf, { contentType: 'image/png', upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = supabaseAdmin.storage.from(IMG_BUCKET).getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // Mark this asset selected, others not.
    await supabaseAdmin.from('assets').update({ is_selected: false }).eq('episode_id', params.id);
    await supabaseAdmin.from('assets').insert({
      episode_id: params.id,
      kind: 'image',
      storage_path: path,
      public_url: publicUrl,
      is_selected: true
    });

    await supabaseAdmin.from('episodes').update({ image_url: publicUrl }).eq('id', params.id);

    const { data: ep } = await supabaseAdmin
      .from('episodes').select('slug').eq('id', params.id).maybeSingle();
    revalidatePath('/');
    revalidatePath('/episodes');
    if (ep?.slug) revalidatePath(`/episode/${ep.slug}`);

    return NextResponse.json({ image_url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
