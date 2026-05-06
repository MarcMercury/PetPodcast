-- ============================================================
-- Pet Podcast — Knowledge / Resource Center
-- Adds an aggregated, sortable index of veterinary topics drawn
-- from podcast transcripts (entity_links) plus approved third-party
-- citations. Every topic that surfaces on the public site MUST
-- carry citations back to the show, the episode, and the vet who
-- spoke about it on that date — no anonymous content.
-- ============================================================

-- ------------------------------------------------------------
-- knowledge_topics — one row per concept
-- ------------------------------------------------------------
create table if not exists pet_podcast.knowledge_topics (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  term text not null,
  -- Reuses the same vocabulary as transcripts.entity_links
  type text not null default 'other'
    check (type in ('condition','medication','breed','procedure','organization','product','nutrient','other')),
  summary text,        -- AI-drafted, human-approved Petspective blurb (<=600 words)
  body text,           -- optional long-form markdown (editor-only)
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  generated_by text,   -- 'gemini-1.5-pro' | 'human' | null
  reviewed_by uuid references pet_podcast.profiles(id) on delete set null,
  reviewed_at timestamptz,
  episode_count int not null default 0,        -- denormalized for sorting
  last_mentioned_at timestamptz,                -- denormalized for sorting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_topics_status on pet_podcast.knowledge_topics(status);
create index if not exists idx_knowledge_topics_type   on pet_podcast.knowledge_topics(type);
create index if not exists idx_knowledge_topics_term   on pet_podcast.knowledge_topics(lower(term));
create index if not exists idx_knowledge_topics_last_mentioned
  on pet_podcast.knowledge_topics(last_mentioned_at desc nulls last);

-- ------------------------------------------------------------
-- knowledge_topic_episodes — many-to-many (with citation context)
-- ------------------------------------------------------------
create table if not exists pet_podcast.knowledge_topic_episodes (
  topic_id uuid references pet_podcast.knowledge_topics(id) on delete cascade,
  episode_id uuid references pet_podcast.episodes(id) on delete cascade,
  -- Snapshot of the speaker for citation purposes; survives vet renames.
  vet_id uuid references pet_podcast.vets(id) on delete set null,
  vet_name text,
  -- Earliest second-mark in the episode where the term appears.
  first_mention_seconds int,
  quote text,                                   -- short transcript pull-quote
  primary key (topic_id, episode_id)
);
create index if not exists idx_knowledge_topic_episodes_episode
  on pet_podcast.knowledge_topic_episodes(episode_id);

-- ------------------------------------------------------------
-- knowledge_sources — third-party citations (allowlisted domains only)
-- ------------------------------------------------------------
create table if not exists pet_podcast.knowledge_sources (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references pet_podcast.knowledge_topics(id) on delete cascade,
  url text not null,
  title text,
  description text,
  publisher text,                               -- e.g. "Merck Vet Manual"
  approved_by uuid references pet_podcast.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (topic_id, url)
);
create index if not exists idx_knowledge_sources_topic on pet_podcast.knowledge_sources(topic_id);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
do $$ begin
  drop trigger if exists trg_knowledge_topics_updated on pet_podcast.knowledge_topics;
  create trigger trg_knowledge_topics_updated before update on pet_podcast.knowledge_topics
    for each row execute function pet_podcast.set_updated_at();
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table pet_podcast.knowledge_topics          enable row level security;
alter table pet_podcast.knowledge_topic_episodes  enable row level security;
alter table pet_podcast.knowledge_sources         enable row level security;

-- Public can read PUBLISHED topics, their episode citations, and their sources.
create policy "public read published knowledge_topics"
  on pet_podcast.knowledge_topics for select
  using (status = 'published');

create policy "public read knowledge_topic_episodes of published"
  on pet_podcast.knowledge_topic_episodes for select
  using (exists (
    select 1 from pet_podcast.knowledge_topics t
    where t.id = knowledge_topic_episodes.topic_id and t.status = 'published'
  ));

create policy "public read knowledge_sources of published"
  on pet_podcast.knowledge_sources for select
  using (exists (
    select 1 from pet_podcast.knowledge_topics t
    where t.id = knowledge_sources.topic_id and t.status = 'published'
  ));

-- Creators (admin/vet) have full write access.
create policy "creators write knowledge_topics"
  on pet_podcast.knowledge_topics for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

create policy "creators write knowledge_topic_episodes"
  on pet_podcast.knowledge_topic_episodes for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

create policy "creators write knowledge_sources"
  on pet_podcast.knowledge_sources for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());
