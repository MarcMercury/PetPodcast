'use client';

// Brand-new episode → one click. Asks only for a working title, creates
// the draft row, then drops you straight into the Studio. Everything else
// (audio, metadata, transcript, cover art, publish) lives in the Studio.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewEpisodePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const slug =
        title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
        `draft-${Date.now()}`;
      const res = await fetch('/api/admin/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), slug })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed to create draft');
      router.push(`/admin/episodes/${j.id}/studio`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl">
      <p className="text-sm uppercase tracking-wide text-sage-500">New episode</p>
      <h1 className="font-display text-3xl font-bold">Start a draft</h1>
      <p className="mt-2 text-sm text-sage-600">
        Give it a working title. You'll record, edit, transcribe, and ship from the Studio.
        You can rename it any time.
      </p>

      <form onSubmit={create} className="card p-6 mt-6 grid gap-4">
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-sage-600">
            Working title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Heatstroke in flat-faced dogs"
            autoFocus
            className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
          />
        </label>
        {err && <p className="text-sm text-red-700">✕ {err}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!title.trim() || busy}
            className="btn-primary disabled:opacity-50"
          >
            {busy ? 'Creating draft…' : 'Open Studio →'}
          </button>
          <Link href="/admin" className="text-sm text-sage-600 hover:underline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
