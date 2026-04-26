// OpenAI: Whisper transcription + GPT-4 summary helpers.
// Uses fetch to avoid the openai SDK dep — keeps install lean.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const BASE = 'https://api.openai.com/v1';

function authHeader() {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');
  return { Authorization: `Bearer ${OPENAI_API_KEY}` };
}

export interface WhisperSegment { start: number; end: number; text: string }
export interface WhisperResult {
  text: string;
  language: string;
  segments: WhisperSegment[];
}

/** Transcribe audio via Whisper. Returns timestamped segments. */
export async function transcribeAudio(audio: Blob, filename = 'episode.mp3'): Promise<WhisperResult> {
  const form = new FormData();
  form.append('file', audio, filename);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');

  const res = await fetch(`${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: authHeader(),
    body: form
  });
  if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return {
    text: json.text,
    language: json.language,
    segments: (json.segments ?? []).map((s: any) => ({ start: s.start, end: s.end, text: s.text }))
  };
}

/** GPT-4 chat helper — JSON-mode response. */
export async function chatJSON<T = unknown>(system: string, user: string): Promise<T> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!res.ok) throw new Error(`OpenAI chat failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return JSON.parse(json.choices[0].message.content) as T;
}

/** DALL-E 3 image generation — returns array of public URLs (1024x1024). */
export async function generateImages(prompt: string, n = 1): Promise<string[]> {
  // DALL-E 3 only supports n=1; call multiple times for variants.
  const calls = Array.from({ length: n }, () =>
    fetch(`${BASE}/images/generations`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'url'
      })
    }).then(async (r) => {
      if (!r.ok) throw new Error(`DALL-E failed: ${r.status} ${await r.text()}`);
      const j = await r.json();
      return j.data[0].url as string;
    })
  );
  return Promise.all(calls);
}
