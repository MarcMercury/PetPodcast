// Home-page strip showing the latest pet recalls. Compact card row +
// "View all" link to /recalls. Renders nothing if the API returns no
// matching recalls (graceful fallback).

import Link from 'next/link';
import {
  fetchPetRecalls,
  formatRecallDate,
  recallSeverityLabel,
  recallSourceUrl
} from '@/lib/fda-recalls';

const TONE_CLASSES: Record<'red' | 'amber' | 'gray', string> = {
  red: 'bg-red-50 text-red-800 ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  gray: 'bg-sage-50 text-sage-800 ring-sage-200'
};

export default async function RecallStrip() {
  const recalls = (await fetchPetRecalls(20)).slice(0, 4);
  if (recalls.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 mt-20" id="recalls">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="eyebrow">Public Service · FDA Feed</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Latest Pet Recalls</h2>
        </div>
        <Link
          href="/recalls"
          className="text-xs text-sage-700 hover:text-sage-900 underline-offset-4 hover:underline"
        >
          View all →
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {recalls.map((r) => {
          const severity = recallSeverityLabel(r.classification);
          return (
            <a
              key={r.recall_number}
              href={recallSourceUrl(r)}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex flex-col gap-2 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${TONE_CLASSES[severity.tone]}`}
                >
                  {severity.label}
                </span>
                <span className="text-[10px] text-sage-600">
                  {formatRecallDate(r.report_date)}
                </span>
              </div>
              <h3 className="text-sm font-bold leading-snug line-clamp-2">{r.recalling_firm}</h3>
              <p className="text-xs text-sage-700 line-clamp-3">{r.product_description}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}
