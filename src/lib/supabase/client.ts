// Browser/anon Supabase client — safe for public reads of `pet_podcast` schema.
import { createBrowserClient } from '@supabase/ssr';
import { assertPetSchema, PET_SCHEMA } from '@/lib/isolation';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || PET_SCHEMA;
assertPetSchema(schema);

export function createSupabaseBrowser() {
  return createBrowserClient(url, anon, { db: { schema } });
}
