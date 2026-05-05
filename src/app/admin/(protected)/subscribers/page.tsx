import { supabaseAdmin } from '@/lib/supabase/admin';
import { SubscriberRow } from './subscriber-row';
import { AddSubscriberForm } from './add-form';

export const dynamic = 'force-dynamic';

type Filter = 'active' | 'unsubscribed' | 'all';

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  unsubscribed_at: string | null;
}

export default async function SubscribersPage({
  searchParams
}: {
  searchParams: { filter?: string; q?: string };
}) {
  const filter: Filter =
    searchParams.filter === 'unsubscribed'
      ? 'unsubscribed'
      : searchParams.filter === 'all'
      ? 'all'
      : 'active';
  const search = (searchParams.q ?? '').trim().toLowerCase();

  let q = supabaseAdmin
    .from('subscribers')
    .select('id,email,source,created_at,unsubscribed_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (filter === 'active') q = q.is('unsubscribed_at', null);
  if (filter === 'unsubscribed') q = q.not('unsubscribed_at', 'is', null);
  if (search) q = q.ilike('email', `%${search}%`);

  const { data, error } = await q;
  const rows = (data ?? []) as Subscriber[];

  const counts = await Promise.all([
    supabaseAdmin
      .from('subscribers')
      .select('id', { count: 'exact', head: true })
      .is('unsubscribed_at', null),
    supabaseAdmin
      .from('subscribers')
      .select('id', { count: 'exact', head: true })
      .not('unsubscribed_at', 'is', null),
    supabaseAdmin.from('subscribers').select('id', { count: 'exact', head: true })
  ]);
  const [active, unsub, total] = counts.map((r) => r.count ?? 0);

  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: 'active', label: 'Active', n: active },
    { key: 'unsubscribed', label: 'Unsubscribed', n: unsub },
    { key: 'all', label: 'All', n: total }
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Subscribers</h2>
          <p className="text-sm text-sage-300 mt-1">
            Listeners opted in to new-episode updates from the homepage. Sending
            transactional mail isn&apos;t wired up yet — this list is the source of
            truth when it is.
          </p>
        </div>
        <div className="flex gap-2">
          {tabs.map((t) => {
            const active = t.key === filter;
            const href =
              t.key === 'active'
                ? '/admin/subscribers'
                : `/admin/subscribers?filter=${t.key}`;
            return (
              <a
                key={t.key}
                href={href}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  active
                    ? 'bg-sage-600 text-cream border-sage-600'
                    : 'bg-ink-soft border-bone text-sage-200 hover:border-sage-400'
                }`}
              >
                {t.label} <span className="opacity-70">({t.n})</span>
              </a>
            );
          })}
        </div>
      </div>

      <AddSubscriberForm />

      <form method="get" className="flex gap-2">
        <input
          type="hidden"
          name="filter"
          value={filter === 'active' ? '' : filter}
        />
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search email…"
          className="flex-1 rounded-lg border border-bone bg-ink-soft text-cream placeholder:text-sage-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400"
        />
        <button
          type="submit"
          className="rounded-lg border border-bone text-cream px-3 py-2 text-sm hover:bg-ink hover:border-sage-700"
        >
          Search
        </button>
        {search && (
          <a
            href={
              filter === 'active'
                ? '/admin/subscribers'
                : `/admin/subscribers?filter=${filter}`
            }
            className="rounded-lg border border-bone text-cream px-3 py-2 text-sm hover:bg-ink hover:border-sage-700"
          >
            Clear
          </a>
        )}
      </form>

      {error && (
        <div className="rounded-lg bg-red-500/10 text-red-300 px-3 py-2 text-sm">
          {error.message}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sage-300">
          {search
            ? `No subscribers match “${search}”.`
            : filter === 'active'
            ? 'No active subscribers yet.'
            : filter === 'unsubscribed'
            ? 'No unsubscribed listeners.'
            : 'Subscriber list is empty.'}
        </div>
      ) : (
        <ul className="grid gap-2">
          {rows.map((r) => (
            <SubscriberRow key={r.id} entry={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
