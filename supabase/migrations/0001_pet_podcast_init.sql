-- ============================================================
-- Pet Podcast — Supabase schema migration
-- Project: cuxuqsnbxwuhdeajrjcz (shared with Stoop Politics)
-- Strategy: dedicated `pet_podcast` schema => zero overlap with `public`
-- Run in: Supabase SQL Editor (as postgres role)
-- ============================================================

create schema if not exists pet_podcast;

-- Expose the schema to PostgREST (so the JS client can hit it)
-- After running this, also add `pet_podcast` to:
--   Supabase Dashboard → Settings → API → "Exposed schemas"
grant usage on schema pet_podcast to anon, authenticated, service_role;
grant all on all tables in schema pet_podcast to service_role;
grant all on all sequences in schema pet_podcast to service_role;
alter default privileges in schema pet_podcast
  grant all on tables to service_role;
alter default privileges in schema pet_podcast
  grant all on sequences to service_role;

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$ begin
  create type pet_podcast.user_role as enum ('admin', 'vet', 'listener');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pet_podcast.episode_status as enum ('draft', 'processing', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pet_podcast.animal_type as enum ('canine', 'feline', 'exotic', 'avian', 'equine', 'other');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- profiles  (extends auth.users with pet-podcast roles)
-- ------------------------------------------------------------
create table if not exists pet_podcast.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  role pet_podcast.user_role not null default 'listener',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- vets
-- ------------------------------------------------------------
create table if not exists pet_podcast.vets (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references pet_podcast.profiles(id) on delete set null,
  name text not null,
  slug text unique not null,
  specialty text,
  clinic_name text,
  clinic_location text,
  bio text,
  bio_photo_url text,
  website_url text,
  social_links jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- episodes
-- ------------------------------------------------------------
create table if not exists pet_podcast.episodes (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  title text not null,
  description text,
  season int,
  episode_number int,
  guest_vet_id uuid references pet_podcast.vets(id) on delete set null,
  audio_url text,
  image_url text,
  duration_seconds int,
  animal_types pet_podcast.animal_type[] default '{}',
  status pet_podcast.episode_status not null default 'draft',
  published_at timestamptz,
  created_by uuid references pet_podcast.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_episodes_status on pet_podcast.episodes(status);
create index if not exists idx_episodes_published_at on pet_podcast.episodes(published_at desc);
create index if not exists idx_episodes_guest_vet on pet_podcast.episodes(guest_vet_id);

-- ------------------------------------------------------------
-- transcripts
-- ------------------------------------------------------------
create table if not exists pet_podcast.transcripts (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null unique references pet_podcast.episodes(id) on delete cascade,
  raw_text text,
  -- Whisper verbose_json segments: [{start, end, text}, ...]
  segments jsonb default '[]'::jsonb,
  language text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- show_notes  (AI-generated summaries, takeaways, chapters)
-- ------------------------------------------------------------
create table if not exists pet_podcast.show_notes (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null unique references pet_podcast.episodes(id) on delete cascade,
  summary text,
  key_takeaways jsonb default '[]'::jsonb,        -- ["...", "..."]
  chapters jsonb default '[]'::jsonb,             -- [{start, title}]
  seo_description text,
  generated_by text,                              -- 'gemini-1.5-pro' | 'gpt-4o'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- assets  (AI image options + uploaded media linked to episodes)
-- ------------------------------------------------------------
create table if not exists pet_podcast.assets (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid references pet_podcast.episodes(id) on delete cascade,
  kind text not null check (kind in ('audio', 'image', 'transcript_json', 'thumbnail_option')),
  storage_path text not null,
  public_url text,
  prompt text,
  is_selected boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_assets_episode on pet_podcast.assets(episode_id);

-- ------------------------------------------------------------
-- tags + episode_tags
-- ------------------------------------------------------------
create table if not exists pet_podcast.tags (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  slug text unique not null
);

create table if not exists pet_podcast.episode_tags (
  episode_id uuid references pet_podcast.episodes(id) on delete cascade,
  tag_id uuid references pet_podcast.tags(id) on delete cascade,
  primary key (episode_id, tag_id)
);

-- ------------------------------------------------------------
-- mailbag  ("Ask a Vet")
-- ------------------------------------------------------------
create table if not exists pet_podcast.mailbag (
  id uuid primary key default uuid_generate_v4(),
  user_email text,
  user_id uuid references pet_podcast.profiles(id) on delete set null,
  question text not null,
  category text,
  assigned_vet_id uuid references pet_podcast.vets(id) on delete set null,
  is_answered boolean default false,
  answered_episode_id uuid references pet_podcast.episodes(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- analytics  (aggregate per episode)
-- ------------------------------------------------------------
create table if not exists pet_podcast.analytics (
  episode_id uuid primary key references pet_podcast.episodes(id) on delete cascade,
  plays int not null default 0,
  unique_listeners int not null default 0,
  avg_completion_rate numeric(5,2) default 0,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- updated_at trigger helper
-- ------------------------------------------------------------
create or replace function pet_podcast.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  for t in
    select unnest(array['profiles','vets','episodes','transcripts','show_notes'])
  loop
    execute format(
      'drop trigger if exists trg_%1$s_updated on pet_podcast.%1$s;
       create trigger trg_%1$s_updated before update on pet_podcast.%1$s
       for each row execute function pet_podcast.set_updated_at();', t);
  end loop;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table pet_podcast.profiles      enable row level security;
alter table pet_podcast.vets          enable row level security;
alter table pet_podcast.episodes      enable row level security;
alter table pet_podcast.transcripts   enable row level security;
alter table pet_podcast.show_notes    enable row level security;
alter table pet_podcast.assets        enable row level security;
alter table pet_podcast.tags          enable row level security;
alter table pet_podcast.episode_tags  enable row level security;
alter table pet_podcast.mailbag       enable row level security;
alter table pet_podcast.analytics     enable row level security;

-- helper: is current user an admin?
create or replace function pet_podcast.is_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from pet_podcast.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- helper: is current user a vet (creator)?
create or replace function pet_podcast.is_creator()
returns boolean language sql stable as $$
  select exists (
    select 1 from pet_podcast.profiles
    where id = auth.uid() and role in ('admin','vet')
  );
$$;

-- public read: published episodes + their child rows + vet directory + tags
create policy "public read published episodes"
  on pet_podcast.episodes for select
  using (status = 'published');

create policy "public read vets"
  on pet_podcast.vets for select using (true);

create policy "public read tags"
  on pet_podcast.tags for select using (true);

create policy "public read episode_tags"
  on pet_podcast.episode_tags for select using (true);

create policy "public read transcripts of published"
  on pet_podcast.transcripts for select
  using (exists (
    select 1 from pet_podcast.episodes e
    where e.id = transcripts.episode_id and e.status = 'published'
  ));

create policy "public read show_notes of published"
  on pet_podcast.show_notes for select
  using (exists (
    select 1 from pet_podcast.episodes e
    where e.id = show_notes.episode_id and e.status = 'published'
  ));

create policy "public read selected assets of published"
  on pet_podcast.assets for select
  using (
    is_selected = true and exists (
      select 1 from pet_podcast.episodes e
      where e.id = assets.episode_id and e.status = 'published'
    )
  );

-- profiles: user reads/updates own, admin reads all
create policy "self read profile"
  on pet_podcast.profiles for select using (id = auth.uid() or pet_podcast.is_admin());
create policy "self update profile"
  on pet_podcast.profiles for update using (id = auth.uid());

-- mailbag: anyone can submit, only creators can read
create policy "anyone submit mailbag"
  on pet_podcast.mailbag for insert with check (true);
create policy "creators read mailbag"
  on pet_podcast.mailbag for select using (pet_podcast.is_creator());

-- creator/admin write access to content tables
create policy "creators write episodes"
  on pet_podcast.episodes for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

create policy "creators write transcripts"
  on pet_podcast.transcripts for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

create policy "creators write show_notes"
  on pet_podcast.show_notes for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

create policy "creators write assets"
  on pet_podcast.assets for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

create policy "admins write vets"
  on pet_podcast.vets for all
  using (pet_podcast.is_admin()) with check (pet_podcast.is_admin());

create policy "admins write tags"
  on pet_podcast.tags for all
  using (pet_podcast.is_admin()) with check (pet_podcast.is_admin());

create policy "creators write episode_tags"
  on pet_podcast.episode_tags for all
  using (pet_podcast.is_creator()) with check (pet_podcast.is_creator());

-- analytics: creators read, service-role writes (server-side only)
create policy "creators read analytics"
  on pet_podcast.analytics for select using (pet_podcast.is_creator());

-- ============================================================
-- Storage buckets — create from Dashboard, or via API:
--   pet-podcast-audio   (private)
--   pet-podcast-images  (public-read)
-- Then add storage policies scoped by bucket name.
-- ============================================================
