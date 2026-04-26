// Hard guardrails to keep Pet Podcast isolated from Stoop Politics.
//
// CONTRACT (do not violate):
//   1. Pet Podcast NEVER reads from or writes to the `public` schema.
//   2. Pet Podcast NEVER reads from or writes to Stoop Politics' storage buckets.
//   3. All Supabase clients in this codebase MUST be created via the helpers in
//      `src/lib/supabase/{admin,server,client}.ts`. Do NOT instantiate
//      `createClient` directly elsewhere — those helpers pin `db.schema`.
//
// This file fails fast at startup if anything is misconfigured.

export const PET_SCHEMA = 'pet_podcast' as const;

export const BUCKETS = {
  audio: 'pet-podcast-audio',
  images: 'pet-podcast-images'
} as const;

// Stoop Politics resources — listed here so we can detect accidental usage.
export const FORBIDDEN_SCHEMAS = ['public'] as const;
export const FORBIDDEN_BUCKETS = ['media', 'podcast-media'] as const;

/** Throw if the provided schema name is anything other than `pet_podcast`. */
export function assertPetSchema(schema: string | undefined): asserts schema is typeof PET_SCHEMA {
  if (schema !== PET_SCHEMA) {
    throw new Error(
      `[isolation] Refusing to use schema "${schema}". Pet Podcast must only ` +
        `query the "${PET_SCHEMA}" schema. Check NEXT_PUBLIC_SUPABASE_SCHEMA env var.`
    );
  }
}

/** Throw if a Stoop-owned bucket name is used. */
export function assertPetBucket(bucket: string): void {
  if ((FORBIDDEN_BUCKETS as readonly string[]).includes(bucket)) {
    throw new Error(
      `[isolation] Refusing to access Stoop Politics bucket "${bucket}". ` +
        `Pet Podcast buckets are: ${Object.values(BUCKETS).join(', ')}.`
    );
  }
}
