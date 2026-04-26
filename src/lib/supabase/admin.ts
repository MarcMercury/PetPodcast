// Server-side Supabase client (service role) — NEVER import in client components.
import { createClient } from '@supabase/supabase-js';
import { assertPetSchema, PET_SCHEMA } from '@/lib/isolation';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || PET_SCHEMA;
assertPetSchema(schema);

if (!url || !serviceKey) {
  // Fail loudly during dev/build; do NOT log values.
  // eslint-disable-next-line no-console
  console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema }
});

export { PET_SCHEMA };
