'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function AddSubscriberForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const res = await fetch('/api/admin/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'admin' })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'add failed');
      }
      setEmail('');
      setOk(true);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || pending;

  return (
    <form onSubmit={submit} className="card p-4 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[240px]">
        <label className="block text-xs uppercase tracking-wide text-sage-600 mb-1">
          Add subscriber
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="listener@example.com"
          className="w-full rounded-lg border border-sage-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-400"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !email}
        className="btn-primary disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add'}
      </button>
      {err && <div className="basis-full text-xs text-red-700">{err}</div>}
      {ok && <div className="basis-full text-xs text-sage-700">Added.</div>}
    </form>
  );
}
