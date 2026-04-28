import { createSupabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Gate: must be signed in + role admin/vet.
  if (!user) redirect('/admin/login');

  // Use service-role to read the profile so RLS doesn't block the role lookup.
  // Safe: we already verified the user via getUser() above.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !['admin', 'vet'].includes(profile.role)) {
    redirect('/admin/login?denied=1');
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between border-b border-sage-100 pb-4">
        <h1 className="font-display text-2xl font-bold">Admin Lab</h1>
        <nav className="flex gap-4 text-sm">
          <Link href="/admin" className="hover:text-sage-600">Dashboard</Link>
          <Link href="/admin/episodes" className="hover:text-sage-600">Episodes</Link>
          <Link href="/admin/episodes/new" className="hover:text-sage-600">New Episode</Link>
          <Link href="/admin/mailbag" className="hover:text-sage-600">Mailbag</Link>
          <Link href="/admin/subscribers" className="hover:text-sage-600">Subscribers</Link>
        </nav>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
