-- ============================================================
-- 0006_subscribers.sql — listener email subscriptions
-- Public visitors opt in to "new episode drop" updates from the
-- homepage. Storage only; sending is out of scope for now (auth
-- email goes through Supabase SMTP; transactional provider TBD).
-- ============================================================

create table if not exists pet_podcast.subscribers (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  source text,                 -- e.g. 'home', 'episode-page'
  user_agent text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create unique index if not exists subscribers_email_uniq
  on pet_podcast.subscribers (lower(email));

alter table pet_podcast.subscribers enable row level security;

-- No client (anon/authenticated) read or write — all access is via
-- the service role through /api/subscribe. Admins can read via the
-- service-role admin client too. Listeners never query this table
-- from the browser. We deliberately add NO permissive policies.

-- Admins-only select policy (so an admin signed in via Studio can
-- list subscribers in a future admin UI without using service role).
do $$ begin
  create policy subscribers_admin_select
    on pet_podcast.subscribers
    for select
    using (pet_podcast.is_admin());
exception when duplicate_object then null; end $$;
