import {
  fetchPetRecalls,
  formatRecallDate,
  recallSeverityLabel,
  recallSourceUrl,
  type FdaRecall
} from '@/lib/fda-recalls';

const TONE_CLASSES: Record<'red' | 'amber' | 'gray', string> = {
  red: 'bg-red-500/15 text-red-300 ring-red-400/40',
  amber: 'bg-amber-500/15 text-amber-200 ring-amber-400/40',
  gray: 'bg-sage-700/30 text-sage-200 ring-sage-500/40'
};

function RecallCard({ r }: { r: FdaRecall }) {
  const severity = recallSeverityLabel(r.classification);
  return (
    <article className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full ring-1 ${TONE_CLASSES[severity.tone]}`}
        >
          {severity.label}
        </span>
        <span className="text-xs text-sage-400">{formatRecallDate(r.report_date)}</span>
      </div>
      <h3 className="text-lg font-display font-bold leading-snug text-cream">{r.recalling_firm}</h3>
      <p className="text-sm text-sage-200 line-clamp-3">{r.product_description}</p>
      <div className="text-sm text-sage-300">
        <span className="font-semibold text-cream">Reason: </span>
        <span className="line-clamp-2">{r.reason_for_recall}</span>
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-sage-400">
        <span>
          {[r.city, r.state, r.country].filter(Boolean).join(', ')}
        </span>
        <a
          href={recallSourceUrl(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sage-300 hover:text-cream underline-offset-4 hover:underline"
        >
          More info →
        </a>
      </div>
    </article>
  );
}

export default async function RecallsPage() {
  const recalls = await fetchPetRecalls(100);

  return (
    <article className="mx-auto max-w-6xl px-6 py-12">
      <p className="eyebrow">Petspective · Public Service</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Pet Food &amp; Drug Recalls</h1>
      <p className="mt-3 max-w-2xl text-sage-200 leading-relaxed">
        Live feed of pet-related recalls from the U.S. Food &amp; Drug Administration&rsquo;s
        Food Enforcement database. Updated hourly. Always cross-check with your veterinarian
        before changing your pet&rsquo;s food or medication.
      </p>

      <p className="mt-6 text-xs text-sage-400">
        Source:{' '}
        <a
          href="https://open.fda.gov/apis/food/enforcement/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4"
        >
          openFDA Food Enforcement API
        </a>
        {' · '}
        {recalls.length} recall{recalls.length === 1 ? '' : 's'} matching pet-related keywords.
      </p>

      {recalls.length === 0 ? (
        <div className="mt-10 card p-8 text-sage-200">
          No recent pet-related recalls found in the FDA feed. That&rsquo;s usually good news.
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recalls.map((r) => (
            <RecallCard key={r.recall_number} r={r} />
          ))}
        </div>
      )}
    </article>
  );
}

export const metadata = {
  title: 'Pet Recalls — Petspective',
  description:
    'Live FDA pet food and drug recall feed, filtered to dog, cat, and other pet products.'
};

export const revalidate = 3600;
