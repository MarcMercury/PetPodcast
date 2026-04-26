# Contributing — Pet Podcast

> **🚨 Read this first.** Pet Podcast shares the Supabase project `cuxuqsnbxwuhdeajrjcz`
> with **Stoop Politics**. The two apps must remain fully isolated. Breaking these rules
> can corrupt or expose Stoop Politics data.

---

## The Isolation Contract

These rules are non-negotiable. They are enforced at build time by [`src/lib/isolation.ts`](src/lib/isolation.ts).

### 1. Database — `pet_podcast` schema only

| ✅ Pet Podcast owns | ❌ Stoop Politics owns — DO NOT TOUCH |
|---|---|
| `pet_podcast.episodes` | `public.episodes` |
| `pet_podcast.transcripts` | `public.transcript_nodes` |
| `pet_podcast.show_notes` | `public.episode_analytics` |
| `pet_podcast.assets` | `public.subscribers` |
| `pet_podcast.vets` | `public.inbox` |
| `pet_podcast.profiles` | `public.domains` |
| `pet_podcast.tags`, `episode_tags` | `public.audit_log` |
| `pet_podcast.mailbag` |   |
| `pet_podcast.analytics` |   |

**Rules:**

- Every new table → `pet_podcast.<name>` (never `public.<name>`).
- Every Supabase client must be created via the helpers in `src/lib/supabase/`. Those helpers pin `db.schema = 'pet_podcast'`.
- **Never** call `createClient`/`createBrowserClient`/`createServerClient` directly anywhere else. The startup guard `assertPetSchema()` will throw at the `lib/supabase/*` layer.
- **Never** write raw cross-schema SQL like `select * from public.episodes`.
- Foreign keys may reference `auth.users(id)` (Supabase's built-in auth) — that's shared and intentional. They must NOT reference any `public.*` table.

### 2. Storage — Pet Podcast buckets only

| ✅ Pet Podcast | ❌ Stoop Politics — DO NOT TOUCH |
|---|---|
| `pet-podcast-audio` (private) | `media` |
| `pet-podcast-images` (public) | `podcast-media` |

Use the constants from `src/lib/isolation.ts`:

```ts
import { BUCKETS } from '@/lib/isolation';
supabaseAdmin.storage.from(BUCKETS.audio).upload(...);
```

The `assertPetBucket()` helper throws if a forbidden bucket name is ever used.

### 3. Auth — shared `auth.users`, separate role profiles

- Both apps share the Supabase Auth user table (`auth.users`). A single email = one account across both products.
- **Roles are stored per-app:** Pet Podcast role lives in `pet_podcast.profiles.role`. Stoop Politics has its own profile mechanism. Adding `role='admin'` to a Pet Podcast profile does **not** grant Stoop admin access (and vice versa).
- When provisioning a user for Pet Podcast, always insert/upsert a row into `pet_podcast.profiles` with the appropriate role.

### 4. RLS policies

- Every new `pet_podcast.*` table **must** enable RLS:
  ```sql
  alter table pet_podcast.<name> enable row level security;
  ```
- Use the helpers `pet_podcast.is_admin()` / `pet_podcast.is_creator()` for write policies.
- Public read policies must include `using (... and exists(...where status='published'))` so drafts never leak.

### 5. Migrations

- Add new SQL files to `supabase/migrations/NNNN_<description>.sql`, sequentially numbered.
- Apply via the Supabase SQL Editor or the management API (see existing migration for the pattern).
- **Never** run migrations that touch the `public` schema.

---

## How to add a new feature (template)

1. **Migration**: create `supabase/migrations/000X_<feature>.sql`. Wrap all DDL in `pet_podcast.<table>`. Enable RLS. Add policies using `pet_podcast.is_creator()`.
2. **Types**: add interfaces to `src/lib/types.ts`.
3. **Server reads**: use `supabaseAdmin` (in `src/app/admin/(protected)/...`) or `createSupabaseServer()` (for public pages with RLS-filtered data).
4. **API routes**: gate with `requireCreator()` from `src/lib/auth.ts`.
5. **Storage**: only use `BUCKETS.audio` or `BUCKETS.images`.
6. **Test isolation locally**: run `npm run build`. The schema assertion runs at module load — any drift will fail fast.

---

## Environment variables

Set these in `.env.local` and Vercel. **Never commit `.env.local`.**

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Shared Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Shared anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role for admin actions (server-only) |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | yes | **Must be `pet_podcast`** — `assertPetSchema()` throws otherwise |
| `SUPABASE_BUCKET_AUDIO` | yes | `pet-podcast-audio` |
| `SUPABASE_BUCKET_IMAGES` | yes | `pet-podcast-images` |
| `OPENAI_API_KEY` | yes | Whisper / GPT / DALL·E |
| `GEMINI_API_KEY` | yes | Show notes generation |
| `NEXT_PUBLIC_SITE_URL` | yes | `https://www.podcast.pet` |

---

## Pre-merge checklist

- [ ] No new code references `public.*` tables
- [ ] No new code uses bucket names `media` or `podcast-media`
- [ ] All new tables enable RLS
- [ ] `npm run build` succeeds locally
- [ ] `npx tsc --noEmit` is clean
