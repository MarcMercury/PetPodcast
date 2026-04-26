import { supabaseAdmin } from '@/lib/supabase/admin';
import Link from 'next/link';

export default async function AdminHome() {
  const supabase = supabaseAdmin;
  const { count: total } = await supabase
    .from('episodes')
    .select('id', { count: 'exact', head: true });
  const { count: published } = await supabase
    .from('episodes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  const { count: drafts } = await supabase
    .from('episodes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft');
  const { count: openMailbag } = await supabase
    .from('mailbag')
    .select('id', { count: 'exact', head: true })
    .eq('is_answered', false);

  const stats = [
    { label: 'Total Episodes', value: total ?? 0 },
    { label: 'Published', value: published ?? 0 },
    { label: 'Drafts', value: drafts ?? 0 },
    { label: 'Open Mailbag', value: openMailbag ?? 0, href: '/admin/mailbag' }
  ];

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const card = (
            <div className="card p-6 h-full">
              <p className="text-xs uppercase text-sage-600 tracking-wider">{s.label}</p>
              <p className="mt-2 text-4xl font-bold">{s.value}</p>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="block hover:opacity-90">
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>
      <div className="mt-8">
        <Link href="/admin/episodes/new" className="btn-primary">
          + Create New Episode
        </Link>
      </div>
    </div>
  );
}
