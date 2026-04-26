// openFDA Food Enforcement (recall) feed.
// Endpoint: https://open.fda.gov/apis/food/enforcement/
// No auth needed. We filter to pet-related recalls by keyword match.

export interface FdaRecall {
  recall_number: string;
  reason_for_recall: string;
  status: string; // 'Ongoing' | 'Completed' | 'Terminated'
  classification: string; // 'Class I' | 'Class II' | 'Class III'
  recalling_firm: string;
  product_description: string;
  product_quantity: string | null;
  distribution_pattern: string | null;
  recall_initiation_date: string | null; // YYYYMMDD
  report_date: string | null; // YYYYMMDD
  voluntary_mandated: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  more_code_info?: string | null;
}

// Keywords that flag a recall as pet-related.
// Matched (case-insensitive) against product_description + reason_for_recall.
const PET_KEYWORDS = [
  'pet',
  'pets',
  'dog',
  'cat',
  'puppy',
  'puppies',
  'kitten',
  'kittens',
  'canine',
  'feline',
  'pet food',
  'pet treat',
  'pet treats',
  'rawhide',
  'kibble',
  'animal feed',
  'horse feed',
  'equine',
  'rabbit food',
  'bird food',
  'reptile',
  'aquarium',
  'fish food'
];

const KEYWORD_RE = new RegExp(
  `\\b(${PET_KEYWORDS.map((k) => k.replace(/\s+/g, '\\s+')).join('|')})\\b`,
  'i'
);

// Build an openFDA search clause that already narrows results server-side.
// product_description.exact would be too strict — use a free-text OR.
function buildSearchClause(): string {
  // openFDA query syntax: field:term, joined with + (AND) or with parentheses.
  // We OR a handful of strong keywords to keep the result set small. We then
  // do a stricter local filter on the response.
  const terms = ['dog', 'cat', 'pet+food', 'puppy', 'kitten', 'animal+feed'];
  const ors = terms.map((t) => `product_description:${t}`).join('+');
  return `(${ors})`;
}

export async function fetchPetRecalls(limit = 50): Promise<FdaRecall[]> {
  const search = buildSearchClause();
  const url = `https://api.fda.gov/food/enforcement.json?search=${search}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      // Recalls don't change minute-to-minute. Cache for 1 hour, refresh in
      // the background via Next's ISR.
      next: { revalidate: 60 * 60, tags: ['fda-recalls'] }
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: FdaRecall[] };
    const all = json.results ?? [];
    // Local stricter filter: must contain a pet keyword as a whole word.
    const filtered = all.filter((r) => {
      const haystack = `${r.product_description ?? ''} ${r.reason_for_recall ?? ''}`;
      return KEYWORD_RE.test(haystack);
    });
    // Newest first by report_date (YYYYMMDD sorts lexically).
    filtered.sort((a, b) => (b.report_date ?? '').localeCompare(a.report_date ?? ''));
    return filtered;
  } catch {
    return [];
  }
}

export function formatRecallDate(yyyymmdd: string | null | undefined): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function recallSeverityLabel(classification: string): {
  label: string;
  tone: 'red' | 'amber' | 'gray';
} {
  if (/class\s*i\b/i.test(classification)) return { label: 'Class I · Serious', tone: 'red' };
  if (/class\s*ii\b/i.test(classification)) return { label: 'Class II · Moderate', tone: 'amber' };
  if (/class\s*iii\b/i.test(classification)) return { label: 'Class III · Low risk', tone: 'gray' };
  return { label: classification || 'Recall', tone: 'gray' };
}

// openFDA links to FDA.gov press-release search by recall number, which is
// the closest thing to a stable "more info" URL.
export function recallSourceUrl(r: FdaRecall): string {
  return `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts?search_api_fulltext=${encodeURIComponent(
    r.recall_number
  )}`;
}
