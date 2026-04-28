// Gemini 1.5 Pro — show-notes generation + entity link extraction.
// Prompts follow the Opus 4.7-style XML scaffolding documented in AGENTS.md §5
// and inject the progressive-learning store from src/lib/ai/learnings.json on
// every call (see AGENTS.md §6).

import { learnedPreferencesBlock, isApprovedDomain } from './learnings';

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

function showNotesSystem(): string {
  return `<role>
  You are the veterinary content editor for "Petspective". Your house style is
  "Doctor's Note": clinical-yet-warm,
  calm, precise, never marketing-y.
</role>

<task>
  Convert the supplied podcast transcript into structured show notes.
</task>

<constraints>
  - Ground every claim in the transcript. Do not invent facts.
  - Match output length to transcript length: ~10 min episode → tight summary;
    ~60 min episode → fuller summary. Do not pad.
  - Honor every rule in <learned_preferences>. They override generic editorial taste.
  - If the transcript names a vet, use "Dr. <Last>" on first reference.
</constraints>

<format>
  Output STRICT JSON matching this TypeScript type — no preface, no trailing text:
  {
    "summary": string,                                   // 2-3 paragraphs, "Doctor's Note" style
    "key_takeaways": string[],                           // exactly 5, imperative or declarative
    "chapters": { "start": number, "title": string }[],  // start in seconds, ascending
    "seo_description": string,                           // ≤155 chars, includes primary topic
    "suggested_image_prompt": string                     // honors <image_prompt_rules>
  }
</format>

${learnedPreferencesBlock(['voice', 'banned_phrases', 'show_notes_rules', 'image_prompt_rules'])}`;
}

export async function generateShowNotes(transcript: string, segmentsHint = ''): Promise<ShowNotesPayload> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `${BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: showNotesSystem() }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `<input>\n  <transcript>\n${transcript}\n  </transcript>\n  <segments_hint>\n${segmentsHint}\n  </segments_hint>\n</input>`
              }
            ]
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

function entitySystem(): string {
  return `<role>
  You are a veterinary research librarian for "Petspective". You identify the
  most educationally valuable named subjects in a transcript and link each to
  an authoritative public reference.
</role>

<task>
  Extract up to 20 entities from the transcript, ranked by educational value,
  and pair each with one trustworthy URL.
</task>

<constraints>
  - "term" must appear verbatim (or near-verbatim) in the transcript.
  - Skip generic words ("dog", "vet", "owner") and brand-less commodities.
  - URL MUST be on an approved domain — see <approved_entity_domains>. Prefer in
    this order: Wikipedia → Merck Vet Manual → AVMA / AAHA / FDA / NIH / Cornell
    / VCA Hospitals → official manufacturer site (only if added to the allowlist).
  - Never invent a URL. If not confident the page exists, omit the entry.
  - "description" is optional, ≤140 chars, plain text, grounded in the transcript.
</constraints>

<format>
  Output STRICT JSON: { "entities": EntityLink[] } where
  EntityLink = { term: string; type: EntityLinkType; url: string; description?: string }
</format>

${learnedPreferencesBlock(['approved_entity_domains', 'voice'])}`;
}

export async function extractEntityLinks(transcript: string): Promise<EntityLink[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `${BASE}/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: entitySystem() }] },
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        contents: [
          {
            role: 'user',
            parts: [{ text: `<input>\n  <transcript>\n${transcript}\n  </transcript>\n</input>` }]
          }
        ]
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini entity-link failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text) as { entities?: EntityLink[] };
  const raw = Array.isArray(parsed.entities) ? parsed.entities : [];

  // Defensive post-processing: enforce shape, dedupe, https-only, allowlist.
  // The allowlist is the runtime enforcement of learnings.approved_entity_domains.
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
    if (!isApprovedDomain(url.toString())) continue;
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

// ---------------------------------------------------------------------------
// Imagen — fallback cover-art generator used when DALL-E is unavailable
// (e.g. OpenAI billing hard-limit). Returns raw PNG buffers; the caller is
// responsible for uploading them somewhere durable.
// ---------------------------------------------------------------------------

const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';

export async function generateImagesImagen(prompt: string, n = 1): Promise<Buffer[]> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not set');
  const sampleCount = Math.min(Math.max(n, 1), 4);

  const res = await fetch(
    `${BASE}/models/${IMAGEN_MODEL}:predict?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount, aspectRatio: '1:1' }
      })
    }
  );

  if (!res.ok) throw new Error(`Imagen failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const preds: Array<{ bytesBase64Encoded?: string }> = json.predictions ?? [];
  const buffers: Buffer[] = [];
  for (const p of preds) {
    if (p?.bytesBase64Encoded) buffers.push(Buffer.from(p.bytesBase64Encoded, 'base64'));
  }
  if (!buffers.length) throw new Error('Imagen returned no images');
  return buffers;
}
