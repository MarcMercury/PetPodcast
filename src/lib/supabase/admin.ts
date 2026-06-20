// Server-side Supabase client (service role) — NEVER import in client components.
// Uses a lazy singleton so importing this module during build (when env vars may be
// absent) does not crash. The client is created on first access.
import { createClient } from '@supabase/supabase-js';
import { assertPetSchema, PET_SCHEMA } from '@/lib/isolation';

const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || PET_SCHEMA;
assertPetSchema(schema);

function buildAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error(
      '[supabase] Cannot create admin client: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema }
  });
}

type Admin = ReturnType<typeof buildAdmin>;
let _instance: Admin | null = null;

/** Lazy admin client — safe to import at module scope without env vars present. */
export const supabaseAdmin = new Proxy({} as Admin, {
  get(_target, prop, receiver) {
    if (!_instance) _instance = buildAdmin();
    const value = Reflect.get(_instance, prop, receiver);
    return typeof value === 'function' ? value.bind(_instance) : value;
  }
});

export { PET_SCHEMA };
