import { supabaseAdmin } from '@/lib/supabase/admin';
import Link from 'next/link';

export default async function EpisodesAdminList() {
  const supabase = supabaseAdmin;
  // Cap the admin list. If we ever exceed this we'll add real pagination.
  const { data: episodes } = await supabase
    .from('episodes')
    .select('id, slug, title, status, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">All Episodes</h2>
        <Link href="/admin/episodes/new" className="btn-primary">+ New</Link>
      </div>
      <div className="mt-6 card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink text-left text-sage-200">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(episodes ?? []).map((e) => (
              <tr key={e.id} className="border-t border-bone">
                <td className="px-4 py-3 font-medium text-cream">
                  <Link href={`/admin/episodes/${e.id}/studio`} className="hover:underline">
                    {e.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-sage-800 text-sage-100 px-2 py-0.5 text-xs">
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sage-300">
                  {e.published_at ? new Date(e.published_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/episodes/${e.id}/studio`} className="text-sage-300 hover:text-cream hover:underline">
                    Open Studio →
                  </Link>
                </td>
              </tr>
            ))}
            {(!episodes || episodes.length === 0) && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sage-400">No episodes yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
