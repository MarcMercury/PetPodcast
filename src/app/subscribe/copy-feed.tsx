'use client';

import { useState } from 'react';

export default function CopyFeedButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input
      const input = document.getElementById('rss-feed-url') as HTMLInputElement | null;
      input?.select();
    }
  }

  return (
    <div className="mt-4 flex flex-col sm:flex-row gap-3">
      <input
        id="rss-feed-url"
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sage-100 font-mono text-sm focus:outline-none focus:border-sage-400"
      />
      <button type="button" onClick={onCopy} className="btn-primary self-start sm:self-auto">
        {copied ? 'Copied!' : 'Copy feed URL'}
      </button>
    </div>
  );
}
