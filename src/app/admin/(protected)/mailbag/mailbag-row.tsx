'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface MailbagEntry {
  id: string;
  user_email: string | null;
  question: string;
  category: string | null;
  is_answered: boolean | null;
  answered_episode_id: string | null;
  created_at: string;
}

export function MailbagRow({ entry }: { entry: MailbagEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const call = async (method: 'PATCH' | 'DELETE', body?: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/mailbag/${entry.id}`, {
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
  const disabled = busy || pending;

  return (
    <li className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-sage-600">
            <span className="font-mono">{date}</span>
            {entry.user_email && (
              <>
                <span>·</span>
                <a
                  href={`mailto:${entry.user_email}`}
                  className="underline hover:text-sage-800 truncate max-w-[280px]"
                >
                  {entry.user_email}
                </a>
              </>
            )}
            {entry.category && (
              <>
                <span>·</span>
                <span className="uppercase tracking-wide">{entry.category}</span>
              </>
            )}
            {entry.is_answered ? (
              <span className="ml-auto rounded-full bg-sage-100 text-sage-800 px-2 py-0.5 text-[11px] font-semibold">
                ANSWERED
              </span>
            ) : (
              <span className="ml-auto rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-semibold">
                OPEN
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-sage-900 whitespace-pre-line">{entry.question}</p>
        </div>
      </div>

      {err && <div className="mt-3 text-xs text-red-700">{err}</div>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => call('PATCH', { is_answered: !entry.is_answered })}
          disabled={disabled}
          className="rounded-lg border border-sage-200 px-3 py-1.5 text-sm hover:bg-sage-50 disabled:opacity-50"
        >
          {entry.is_answered ? 'Mark open' : 'Mark answered'}
        </button>
        {entry.user_email && (
          <a
            href={`mailto:${entry.user_email}?subject=Re%3A%20your%20Petspective%20question`}
            className="rounded-lg border border-sage-200 px-3 py-1.5 text-sm hover:bg-sage-50"
          >
            Reply by email
          </a>
        )}
        <button
          onClick={() => {
            if (confirm('Delete this mailbag entry? This cannot be undone.')) call('DELETE');
          }}
          disabled={disabled}
          className="ml-auto rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-sm hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
