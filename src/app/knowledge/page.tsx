import Link from 'next/link';
import { createSupabaseServer } from '@/lib/supabase/server';

export const revalidate = 300;

type TopicRow = {
  slug: string;
  term: string;
  type: string;
  summary: string | null;
  episode_count: number;
  last_mentioned_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  condition: 'Condition',
  medication: 'Medication',
  procedure: 'Procedure',
  breed: 'Breed',
  nutrient: 'Nutrient',
  organization: 'Organization',
  product: 'Product',
  other: 'Topic'
};

export default async function KnowledgePage() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('knowledge_topics')
    .select('slug, term, type, summary, episode_count, last_mentioned_at')
    .eq('status', 'published')
    .order('term', { ascending: true });

  const topics = (data ?? []) as TopicRow[];

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-sage-400">Petspective</p>
        <h1 className="mt-2 text-4xl font-display font-bold tracking-tight text-cream">
          Knowledge Center
        </h1>
        <p className="mt-3 max-w-2xl text-sage-200">
          A growing index of veterinary topics covered on the show — every entry cites
          the episode, date, and vet who discussed it, paired with sources from
          peer-reviewed and clinical references. Built from the transcripts; reviewed
          before it&rsquo;s published here.
        </p>
      </header>

      {topics.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sage-200">
            The Knowledge Center is being assembled from past episodes. Check back soon.
          </p>
          <p className="mt-3 text-sm text-sage-400">
            In the meantime, browse the{' '}
            <Link href="/episodes" className="underline hover:text-sage-300">
              episode archive
            </Link>
            .
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/knowledge/${t.slug}`}
                className="card block p-5 hover:ring-1 hover:ring-sage-400/40 transition"
              >
                <span className="text-[11px] uppercase tracking-wider text-sage-400">
                  {TYPE_LABEL[t.type] ?? 'Topic'}
                </span>
                <h2 className="mt-1 text-lg font-display font-bold text-cream">{t.term}</h2>
                {t.summary ? (
                  <p className="mt-2 text-sm text-sage-200 line-clamp-3">{t.summary}</p>
                ) : null}
                <p className="mt-3 text-xs text-sage-400">
                  {t.episode_count} {t.episode_count === 1 ? 'episode' : 'episodes'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
