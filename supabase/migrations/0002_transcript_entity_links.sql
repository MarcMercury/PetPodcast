-- ============================================================
-- Pet Podcast — add AI-detected entity links to transcripts
-- ============================================================
-- Each entry: { term, type, url, description? }
--   type ∈ 'condition' | 'medication' | 'breed' | 'procedure'
--          | 'organization' | 'product' | 'nutrient' | 'other'

alter table pet_podcast.transcripts
  add column if not exists entity_links jsonb not null default '[]'::jsonb;
