import { supabaseAdmin } from '@/lib/supabase/admin';
import Link from 'next/link';

type Row = {
  id: string;
  title: string;
  status: string;
  season: number | null;
  episode_number: number | null;
  published_at: string | null;
  updated_at: string | null;
};

export default async function AdminHome() {
  const supabase = supabaseAdmin;

  // "Drafts" = anything started but not yet published (draft or processing).
  // "Published" = live to listeners.
  const [{ data: drafts }, { data: published }, { count: openMailbag }, { count: activeSubs }] = await Promise.all([
    supabase
      .from('episodes')
      .select('id, title, status, season, episode_number, published_at, updated_at')
      .in('status', ['draft', 'processing'])
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('episodes')
      .select('id, title, status, season, episode_number, published_at, updated_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20),
    supabase.from('mailbag').select('id', { count: 'exact', head: true }).eq('is_answered', false),
    supabase.from('subscribers').select('id', { count: 'exact', head: true }).is('unsubscribed_at', null)
  ]);

  const draftRows = (drafts ?? []) as Row[];
  const publishedRows = (published ?? []) as Row[];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile label="Drafts" value={draftRows.length} />
        <StatTile label="Published" value={publishedRows.length} />
        <StatTile label="Open Mailbag" value={openMailbag ?? 0} href="/admin/mailbag" />
        <StatTile label="Subscribers" value={activeSubs ?? 0} href="/admin/subscribers" />
      </div>

      <div className="flex">
        <Link href="/admin/episodes/new" className="btn-primary">
          + Create New Episode
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <EpisodeColumn
          title="Drafts"
          subtitle="Started but not yet published"
          rows={draftRows}
          emptyHint="No drafts in progress."
          showStatus
        />
        <EpisodeColumn
          title="Published Episodes"
          subtitle="Live on Petspective"
          rows={publishedRows}
          emptyHint="Nothing published yet."
        />
      </div>
    </div>
  );
}

function StatTile({ label, value, href }: { label: string; value: number; href?: string }) {
  const card = (
    <div className="card p-6 h-full">
      <p className="text-xs uppercase text-sage-600 tracking-wider">{label}</p>
      <p className="mt-2 text-4xl font-bold">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {card}
    </Link>
  ) : (
    <div>{card}</div>
  );
}

function EpisodeColumn({
  title,
  subtitle,
  rows,
  emptyHint,
  showStatus = false
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  emptyHint: string;
  showStatus?: boolean;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <p className="text-xs text-sage-500">{subtitle}</p>
        </div>
        <Link href="/admin/episodes" className="text-xs text-sage-600 hover:underline">
          All →
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-sage-500">{emptyHint}</p>
      ) : (
        <ul className="mt-4 divide-y divide-sage-100">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-sage-500">
                    {r.season ? `S${r.season} · ` : ''}
                    {r.episode_number ? `Ep ${r.episode_number}` : 'Episode'}
                    {showStatus && r.status !== 'draft' ? ` · ${r.status}` : ''}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">{r.title}</p>
                  <p className="mt-1 text-xs text-sage-500">
                    {r.published_at
                      ? `Published ${new Date(r.published_at).toLocaleDateString()}`
                      : r.updated_at
                        ? `Updated ${new Date(r.updated_at).toLocaleDateString()}`
                        : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-3 text-xs">
                  <Link
                    href={`/admin/episodes/${r.id}/studio`}
                    className="text-sage-700 hover:underline"
                  >
                    Open Studio →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
