import {
  fetchPetRecalls,
  formatRecallDate,
  recallSeverityLabel,
  recallSourceUrl,
  type FdaRecall
} from '@/lib/fda-recalls';

const TONE_CLASSES: Record<'red' | 'amber' | 'gray', string> = {
  red: 'bg-red-50 text-red-800 ring-red-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  gray: 'bg-sage-50 text-sage-800 ring-sage-200'
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
        <span className="text-xs text-sage-600">{formatRecallDate(r.report_date)}</span>
      </div>
      <h3 className="text-lg font-bold leading-snug">{r.recalling_firm}</h3>
      <p className="text-sm text-sage-800 line-clamp-3">{r.product_description}</p>
      <div className="text-sm text-sage-700">
        <span className="font-semibold">Reason: </span>
        <span className="line-clamp-2">{r.reason_for_recall}</span>
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-sage-600">
        <span>
          {[r.city, r.state, r.country].filter(Boolean).join(', ')}
        </span>
        <a
          href={recallSourceUrl(r)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sage-800 hover:text-ink underline-offset-4 hover:underline"
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
      <p className="mt-3 max-w-2xl text-sage-800 leading-relaxed">
        Live feed of pet-related recalls from the U.S. Food &amp; Drug Administration&rsquo;s
        Food Enforcement database. Updated hourly. Always cross-check with your veterinarian
        before changing your pet&rsquo;s food or medication.
      </p>

      <p className="mt-6 text-xs text-sage-600">
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
        <div className="mt-10 card p-8 text-sage-700">
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
