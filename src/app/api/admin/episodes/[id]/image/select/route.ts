import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireCreator } from '@/lib/auth';
import { BUCKETS, assertPetBucket } from '@/lib/isolation';

const IMG_BUCKET = process.env.SUPABASE_BUCKET_IMAGES || BUCKETS.images;
assertPetBucket(IMG_BUCKET);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireCreator();
  if ('error' in auth) return auth.error;

  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  try {
    // Download remote AI image, then re-upload to our Supabase bucket for permanence.
    const r = await fetch(url);
    if (!r.ok) throw new Error('failed to fetch source image');
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

    return NextResponse.json({ image_url: publicUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
