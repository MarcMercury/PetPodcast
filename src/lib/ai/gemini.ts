// Gemini 1.5 Pro — show-notes generation + image-prompt suggestions.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = 'gemini-1.5-pro-latest';
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface ShowNotesPayload {
  summary: string;
  key_takeaways: string[];
  chapters: { start: number; title: string }[];
  seo_description: string;
  suggested_image_prompt: string;
}

const SYSTEM = `You are a veterinary content editor for "Pet Podcast" — clinical-yet-warm tone (Green Dog clinic aesthetic).
Given a podcast transcript, output STRICT JSON matching this TypeScript type:
{
  "summary": string,                              // 2-3 paragraph "Doctor's Note" style
  "key_takeaways": string[],                      // exactly 5 bullets, plain text
  "chapters": { "start": number, "title": string }[], // start in seconds
  "seo_description": string,                      // <=155 chars
  "suggested_image_prompt": string                // visual prompt for episode art
}`;

export async function generateShowNotes(transcript: string, segmentsHint = ''): Promise<ShowNotesPayload> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `${BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        contents: [
          {
            role: 'user',
            parts: [{ text: `Transcript:\n${transcript}\n\nSegments hint:\n${segmentsHint}` }]
          }
        ]
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(text) as ShowNotesPayload;
}

// ---------------------------------------------------------------------------
// Entity linking — pull out key veterinary subjects/items from a transcript
// and map each to an authoritative outside reference URL.
// ---------------------------------------------------------------------------

export type EntityLinkType =
  | 'condition'
  | 'medication'
  | 'breed'
  | 'procedure'
  | 'organization'
  | 'product'
  | 'nutrient'
  | 'other';

export interface EntityLink {
  term: string;
  type: EntityLinkType;
  url: string;
  description?: string;
}

const ENTITY_SYSTEM = `You are a veterinary research librarian for "Pet Podcast".
Given a podcast transcript, identify the most important named subjects and items
a curious pet owner might want to look up — diseases, medications, procedures,
breeds, nutrients, organizations (e.g. AVMA, AAHA, FDA-CVM), and notable products.

Rules:
- Return AT MOST 20 entries, ranked by educational value.
- "term" must appear verbatim (or near-verbatim) in the transcript.
- Skip generic words ("dog", "vet", "owner") and brand-less commodities.
- "url" MUST be an authoritative public reference. Prefer in this order:
    1. Wikipedia (https://en.wikipedia.org/wiki/<Title>)
    2. Merck Veterinary Manual (https://www.merckvetmanual.com/...)
    3. AVMA / AAHA / FDA / NIH / Cornell / VCA Hospitals official pages
    4. Official manufacturer site for products
- Never invent a URL you are not confident exists. If unsure, omit the entry.
- "description" is optional, <= 140 chars, plain text.
- Output STRICT JSON: { "entities": EntityLink[] }`;

export async function extractEntityLinks(transcript: string): Promise<EntityLink[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `${BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ENTITY_SYSTEM }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        contents: [
          { role: 'user', parts: [{ text: `Transcript:\n${transcript}` }] }
        ]
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini entity-link failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text) as { entities?: EntityLink[] };
  const raw = Array.isArray(parsed.entities) ? parsed.entities : [];

  // Defensive: enforce shape, dedupe by lowercased term, keep https-only URLs.
  const seen = new Set<string>();
  const out: EntityLink[] = [];
  for (const e of raw) {
    if (!e || typeof e.term !== 'string' || typeof e.url !== 'string') continue;
    const term = e.term.trim();
    if (!term) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    let url: URL;
    try { url = new URL(e.url); } catch { continue; }
    if (url.protocol !== 'https:') continue;
    seen.add(key);
    out.push({
      term,
      type: (e.type ?? 'other') as EntityLinkType,
      url: url.toString(),
      description: typeof e.description === 'string' ? e.description.slice(0, 200) : undefined
    });
    if (out.length >= 20) break;
  }
  return out;
}
