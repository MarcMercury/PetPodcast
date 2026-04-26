// Server-component Supabase client — uses anon key + cookies for auth context.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertPetSchema, PET_SCHEMA } from '@/lib/isolation';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || PET_SCHEMA;
assertPetSchema(schema);

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(url, anon, {
    db: { schema },
    cookies: {
      get: (n: string) => cookieStore.get(n)?.value,
      set: () => {},
      remove: () => {}
    }
  });
}
