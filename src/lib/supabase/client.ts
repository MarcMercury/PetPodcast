// Browser/anon Supabase client — safe for public reads of `pet_podcast` schema.
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'pet_podcast';

export function createSupabaseBrowser() {
  return createBrowserClient(url, anon, { db: { schema } });
}
