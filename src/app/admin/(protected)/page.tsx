import { createSupabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function AdminHome() {
  const supabase = createSupabaseServer();
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

  const stats = [
    { label: 'Total Episodes', value: total ?? 0 },
    { label: 'Published', value: published ?? 0 },
    { label: 'Drafts', value: drafts ?? 0 }
  ];

  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-6">
            <p className="text-xs uppercase text-sage-600 tracking-wider">{s.label}</p>
            <p className="mt-2 text-4xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <Link href="/admin/episodes/new" className="btn-primary">
          + Create New Episode
        </Link>
      </div>
    </div>
  );
}
