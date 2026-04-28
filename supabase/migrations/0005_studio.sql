-- ============================================================
-- Pet Podcast — Studio (recording / editing console)
--   * word-level Whisper timestamps on transcripts
--   * per-episode editor project (cuts, chapters, intro/outro,
--     auphonic polish state, last rendered output)
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Word-level transcript timestamps (drives transcript editing)
-- ----------------------------------------------------------------
alter table pet_podcast.transcripts
  add column if not exists words jsonb not null default '[]'::jsonb;
  -- words: [{ word: string, start: number, end: number }]

-- ----------------------------------------------------------------
-- 2. studio_projects — one row per episode, holds editor state
-- ----------------------------------------------------------------
create table if not exists pet_podcast.studio_projects (
  episode_id uuid primary key references pet_podcast.episodes(id) on delete cascade,
  -- Time ranges (seconds, on the *source* timeline) to remove on render.
  cuts jsonb not null default '[]'::jsonb,        -- [{ start, end }]
  -- Chapter markers (seconds, source timeline).
  chapters jsonb not null default '[]'::jsonb,    -- [{ time, title }]
  -- Optional intro / outro audio prepended / appended on render.
  intro_path text,
  outro_path text,
  -- Auphonic polish workflow.
  auphonic_uuid text,
  auphonic_status text,                            -- queued | processing | done | error
  polished_audio_path text,                        -- post-Auphonic audio in our bucket
  -- Last in-browser render output (the published-quality MP3).
  final_audio_path text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_studio_projects_updated
  on pet_podcast.studio_projects (updated_at desc);

alter table pet_podcast.studio_projects enable row level security;

-- Creators can do anything with their studio projects.
drop policy if exists "creators all studio_projects" on pet_podcast.studio_projects;
create policy "creators all studio_projects"
  on pet_podcast.studio_projects for all
  using (pet_podcast.is_creator())
  with check (pet_podcast.is_creator());

drop trigger if exists trg_studio_projects_updated on pet_podcast.studio_projects;
create trigger trg_studio_projects_updated
  before update on pet_podcast.studio_projects
  for each row execute function pet_podcast.set_updated_at();
