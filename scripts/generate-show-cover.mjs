// One-off generator for the Petspective show-level cover art used by the
// RSS feed (referenced from src/app/feed.xml/route.ts as the channel
// <itunes:image>). Apple Podcasts requires 1400–3000 px square, so we
// generate a DALL-E 3 HD square at 1024 and upscale to 3000 with sharp.
//
// Run: node scripts/generate-show-cover.mjs
// Output: public/brand/show-cover.jpg

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';

// Minimal .env.local loader so this script works without next.js runtime.
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  // ignore — env may already be set
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) {
  console.error('OPENAI_API_KEY missing — set it in .env.local');
  process.exit(1);
}

const learnings = JSON.parse(
  readFileSync('src/lib/ai/learnings.json', 'utf8')
);
const learnedRules = (learnings.image_prompt_rules ?? [])
  .map((r) => `- ${r}`)
  .join('\n');

const prompt = [
  'Petspective podcast cover art — show-level hero image.',
  'Editorial veterinary-magazine cover illustration. Painterly, slightly textured, soft natural light.',
  'Calm, clinical-yet-warm mood. Empathetic, not cute. Square 1:1 framing with strong negative space at top-left for a future title overlay.',
  'Palette strictly: sage green (#3f6d4e / #9ab39e), warm cream / gallery off-white (#f4ead8), and ink near-black (#1f3a26 / #14201a). No reds, no blues, no neon, no gradients outside this palette.',
  'Absolutely no human faces or hands visible. Absolutely no rendered text, captions, watermarks, logos, signage, books, or signs of any kind. No collage, no split-frame, no UI mockups. No cartoon mascot style. No 3D-render plastic look. Photographic-grade lighting, gentle film grain.',
  'Subject: a quiet, dignified grouping suggesting the breadth of the show — a calm dog in profile and a small cat companion resting nearby, against a cream studio backdrop with subtle sage shadow. Single composition, no panels.',
  'Additional learned style rules:',
  learnedRules || '- (none yet)'
].join('\n');

console.log('Generating cover via DALL-E 3 HD…');
const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'hd',
    response_format: 'b64_json'
  })
});

if (!res.ok) {
  console.error(`DALL-E error: ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const { data } = await res.json();
const buf = Buffer.from(data[0].b64_json, 'base64');

const outPath = resolve('public/brand/show-cover.jpg');
await sharp(buf)
  .resize(3000, 3000, { kernel: 'lanczos3' })
  .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: '4:4:4' })
  .toFile(outPath);

console.log(`Wrote ${outPath} (3000×3000 JPG)`);
