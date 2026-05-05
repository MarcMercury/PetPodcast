import { supabaseAdmin } from '@/lib/supabase/admin';
import { MailbagRow } from './mailbag-row';

export const dynamic = 'force-dynamic';

type Filter = 'all' | 'open' | 'answered';

interface MailbagEntry {
  id: string;
  user_email: string | null;
  question: string;
  category: string | null;
  is_answered: boolean | null;
  answered_episode_id: string | null;
  created_at: string;
}

export default async function MailbagInbox({
  searchParams
}: {
  searchParams: { filter?: string };
}) {
  const filter: Filter =
    searchParams.filter === 'answered'
      ? 'answered'
      : searchParams.filter === 'all'
      ? 'all'
      : 'open';

  let q = supabaseAdmin
    .from('mailbag')
    .select('id,user_email,question,category,is_answered,answered_episode_id,created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (filter === 'open') q = q.eq('is_answered', false);
  if (filter === 'answered') q = q.eq('is_answered', true);

  const { data, error } = await q;
  const rows = (data ?? []) as MailbagEntry[];

  const counts = await Promise.all([
    supabaseAdmin.from('mailbag').select('id', { count: 'exact', head: true }).eq('is_answered', false),
    supabaseAdmin.from('mailbag').select('id', { count: 'exact', head: true }).eq('is_answered', true),
    supabaseAdmin.from('mailbag').select('id', { count: 'exact', head: true })
  ]);
  const [open, answered, total] = counts.map((r) => r.count ?? 0);

  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: 'open', label: 'Open', n: open },
    { key: 'answered', label: 'Answered', n: answered },
    { key: 'all', label: 'All', n: total }
  ];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Mailbag</h2>
          <p className="text-sm text-sage-300 mt-1">
            The Wildcard queue. Listener questions submitted from the homepage form —
            pulled live on air by the random question generator during the wildcard
            segment.
          </p>
        </div>
        <div className="flex gap-2">
          {tabs.map((t) => {
            const active = t.key === filter;
            return (
              <a
                key={t.key}
                href={t.key === 'open' ? '/admin/mailbag' : `/admin/mailbag?filter=${t.key}`}
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

      {error && (
        <div className="rounded-lg bg-red-500/10 text-red-300 px-3 py-2 text-sm">
          {error.message}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sage-300">
          {filter === 'open'
            ? 'Inbox zero. No open questions right now.'
            : filter === 'answered'
            ? 'No answered questions yet.'
            : 'Mailbag is empty.'}
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <MailbagRow key={r.id} entry={r} />
          ))}
        </ul>
      )}
    </div>
  );
}
