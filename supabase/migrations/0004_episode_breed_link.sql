-- ============================================================
-- Pet Podcast — link episodes to a breed for the /breeds pages
-- ============================================================
-- Lets a breed page list "episodes featuring this breed".
-- Both columns are nullable: episodes don't have to be breed-specific.

alter table pet_podcast.episodes
  add column if not exists breed_species text check (breed_species in ('dog','cat')),
  add column if not exists breed_slug text;

create index if not exists episodes_breed_idx
  on pet_podcast.episodes (breed_species, breed_slug)
  where breed_slug is not null;
