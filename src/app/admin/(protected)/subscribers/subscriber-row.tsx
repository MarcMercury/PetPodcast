'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Subscriber {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
  unsubscribed_at: string | null;
}

export function SubscriberRow({ entry }: { entry: Subscriber }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const call = async (method: 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/subscribers/${entry.id}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `${method} failed`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const date = new Date(entry.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const isUnsub = !!entry.unsubscribed_at;
  const disabled = busy || pending;

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-sage-300">
            <span className="font-mono">{date}</span>
            {entry.source && (
              <>
                <span>·</span>
                <span className="uppercase tracking-wide">{entry.source}</span>
              </>
            )}
            {isUnsub ? (
              <span className="rounded-full bg-stone-200 text-stone-700 px-2 py-0.5 text-[11px] font-semibold">
                UNSUBSCRIBED
              </span>
            ) : (
              <span className="rounded-full bg-sage-100 text-sage-800 px-2 py-0.5 text-[11px] font-semibold">
                ACTIVE
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm font-medium text-cream">{entry.email}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => call('PATCH', { unsubscribed: !isUnsub })}
            disabled={disabled}
            className="rounded-lg border border-bone text-cream px-3 py-1.5 text-sm hover:bg-ink hover:border-sage-700 disabled:opacity-50"
          >
            {isUnsub ? 'Resubscribe' : 'Unsubscribe'}
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete ${entry.email}? This cannot be undone.`)) call('DELETE');
            }}
            disabled={disabled}
            className="rounded-lg border border-red-500/40 text-red-300 px-3 py-1.5 text-sm hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {err && <div className="mt-2 text-xs text-red-300">{err}</div>}
    </li>
  );
}
