// Auth helper for admin API routes — verifies user has 'admin' or 'vet' role.
import { createSupabaseServer } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function requireCreator() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!profile || !['admin', 'vet'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  }
  return { user, profile };
}
