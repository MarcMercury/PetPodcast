// Server-side Supabase client (service role) — NEVER import in client components.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'pet_podcast';

if (!url || !serviceKey) {
  // Fail loudly during dev/build; do NOT log values.
  // eslint-disable-next-line no-console
  console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema }
});

export const PET_SCHEMA = schema;
