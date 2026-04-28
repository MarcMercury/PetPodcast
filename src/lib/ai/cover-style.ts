// Petspective cover-art house style.
// Every episode tile must look like it came from the same magazine.
// Use buildCoverPrompt() everywhere we call DALL-E for episode covers so
// the visual language stays consistent.
//
// Rules are also reflected in src/lib/ai/learnings.json → image_prompt_rules.
// Update both if the brand evolves.

import { loadLearnings } from '@/lib/ai/learnings';

export interface CoverSubjectInput {
  /** Short phrase describing what's in the frame, e.g. "a calm tabby cat resting on a vet exam table". */
  subject: string;
  /** Optional species hint: 'dog' | 'cat' | 'bird' | 'horse' | 'exotic'. */
  species?: string | null;
  /** Optional one-line topic from the episode (e.g. "dental cleaning under anesthesia"). */
  topic?: string | null;
}

const HOUSE_STYLE = [
  'Editorial veterinary-magazine cover illustration.',
  'Painterly, slightly textured, soft natural light.',
  'Calm, clinical-yet-warm mood. Empathetic, not cute.',
  'Composition: subject offset to the right, clean negative space top-left for a title overlay.',
  'Square 1:1 framing.'
].join(' ');

const PALETTE =
  'Palette strictly: sage green (#3f6d4e / #9ab39e), warm cream / gallery off-white (#f4ead8), and ink near-black (#1f3a26 / #14201a). No reds, no blues, no neon, no gradients outside this palette.';

const HARD_CONSTRAINTS = [
  'Absolutely no human faces or hands visible.',
  'Absolutely no rendered text, captions, watermarks, logos, signage, books, or signs of any kind.',
  'No collage, no split-frame, no UI mockups.',
  'No cartoon mascot style. No 3D-render plastic look.',
  'Photographic-grade lighting, gentle film grain.'
].join(' ');

/**
 * Wrap a short subject phrase in the Petspective house style + the
 * runtime-learned image rules. This is the single source of truth for
 * cover art prompts — `/api/admin/episodes/[id]/image` always passes
 * user input through this builder.
 */
export function buildCoverPrompt(input: CoverSubjectInput): string {
  const learnings = loadLearnings();
  const learnedRules = (learnings?.image_prompt_rules ?? []).map((r) => `- ${r}`).join('\n');

  const speciesHint = input.species
    ? `Featured species: ${input.species}.`
    : '';
  const topicHint = input.topic ? `Episode topic context: ${input.topic}.` : '';

  return [
    'Petspective podcast cover art.',
    HOUSE_STYLE,
    PALETTE,
    HARD_CONSTRAINTS,
    speciesHint,
    topicHint,
    `Subject: ${input.subject.trim()}`,
    'Additional learned style rules:',
    learnedRules || '- (none yet)'
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Detect whether an incoming string is already a wrapped house-style
 * prompt (so we don't double-wrap it on the second click).
 */
export function isWrappedCoverPrompt(s: string | null | undefined): boolean {
  if (!s) return false;
  return s.includes('Petspective podcast cover art.') && s.includes('Palette strictly:');
}
