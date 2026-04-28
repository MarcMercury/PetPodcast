// Auphonic API client — one-shot loudness leveling, denoise, hipass.
// Docs: https://auphonic.com/help/api/
//
// We submit a *Production* (not a Preset+Production) by URL: Auphonic pulls
// the source audio from a temporary signed URL we generate from Supabase
// storage, runs its algorithms, and stores the output on its servers. We
// then download the result and re-upload to our `pet-podcast-audio` bucket.

const BASE = 'https://auphonic.com/api';

function authHeader() {
  const key = process.env.AUPHONIC_API_KEY;
  if (!key) throw new Error('AUPHONIC_API_KEY not set');
  // Auphonic supports either Basic auth or a Bearer token.
  return { Authorization: `Bearer ${key}` };
}

export interface AuphonicProduction {
  uuid: string;
  status: number;          // 0=queued ... 3=done, 9=error (see Auphonic docs)
  status_string: string;
  output_files: { format: string; download_url: string; size?: number }[];
}

/**
 * Submit a new production from a public/signed input URL and start it.
 * Returns the production UUID. Poll with `getProduction` until status == 3.
 */
export async function submitProduction(input_file: string, title: string): Promise<string> {
  const res = await fetch(`${BASE}/productions.json`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      input_file,
      algorithms: {
        leveler: true,
        normloudness: true,
        loudnesstarget: -16,   // podcast standard (Spotify/Apple)
        denoise: true,
        denoiseamount: 12,
        hipfilter: true
      },
      output_files: [{ format: 'mp3', bitrate: 128, mono_mixdown: false }],
      action: 'start'
    })
  });
  if (!res.ok) throw new Error(`Auphonic submit failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  if (!json?.data?.uuid) throw new Error('Auphonic returned no uuid');
  return json.data.uuid as string;
}

export async function getProduction(uuid: string): Promise<AuphonicProduction> {
  const res = await fetch(`${BASE}/production/${uuid}.json`, { headers: authHeader() });
  if (!res.ok) throw new Error(`Auphonic poll failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const d = json.data;
  return {
    uuid: d.uuid,
    status: d.status,
    status_string: d.status_string,
    output_files: d.output_files ?? []
  };
}

/** Map Auphonic numeric status → our column enum. */
export function mapStatus(n: number): 'queued' | 'processing' | 'done' | 'error' {
  if (n === 3) return 'done';
  if (n === 9) return 'error';
  if (n === 0 || n === 1) return 'queued';
  return 'processing';
}
