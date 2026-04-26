// Server-component Supabase client — uses anon key + cookies for auth context.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'pet_podcast';

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
