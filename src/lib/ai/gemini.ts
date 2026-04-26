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
