# Petspective 🐾

> **The Vet's Eye View.**
> Real vets. Real advice. Real pet stories.
> Listener-facing brand: **Petspective** · Internal codename / database namespace: `pet_podcast`.

Petspective is a Green Dog production. The site is a Next.js 14 (App Router) app that ships every episode with a Whisper transcript, a Gemini-written "Doctor's Note" show-notes block, AI-generated cover art, and an entity-linked transcript player so listeners can click through any condition, breed, medication, or organization mentioned on-air.

The repo lives at [`MarcMercury/PetPodcast`](https://github.com/MarcMercury/PetPodcast) and deploys to [`www.podcast.pet`](https://www.podcast.pet) via Vercel. It shares one Supabase project with **Stoop Politics** and is isolated by a dedicated `pet_podcast` schema — see [CONTRIBUTING.md](CONTRIBUTING.md) for the isolation contract.

> 💡 If you're an AI coding agent (Copilot, Claude, Cursor, etc.) working in this repo, **start with [AGENTS.md](AGENTS.md)**. It describes the Opus 4.7-style prompting contract and the progressive-learning loop that keeps prompts and behavior improving over time.

---

## ⚠️ Key rotation

Any API key pasted into chat — at any point, ever — is considered burned. Rotate it the moment it leaves a secrets manager:

- **OpenAI:** <https://platform.openai.com/api-keys>
- **Gemini:** <https://aistudio.google.com/app/apikey>
- **Supabase service role:** Dashboard → Settings → API → "Reset service role key"
- **Podcast Index:** <https://api.podcastindex.org/>

New keys go in `.env.local` (gitignored) and Vercel project env vars only. Never paste them into chat or commit them.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS — gallery / sage / ink palette ("Vet's Eye View" aesthetic) |
| Database & Auth | Supabase (project `cuxuqsnbxwuhdeajrjcz`, schema `pet_podcast`) |
| Storage | Supabase Storage (`pet-podcast-audio` private, `pet-podcast-images` public) |
| Audio embed | Spotify episode embed (per-episode `spotify_url` column) |
| AI — transcription | OpenAI Whisper (verbose JSON, segmented) |
| AI — show notes | Google Gemini 1.5 Pro (summary, takeaways, chapters, entity links) |
| AI — cover art | OpenAI DALL·E 3 (4 variants → admin picks) |
| Cross-platform listen links | Podcast Index API |
| Hosting | Vercel @ `www.podcast.pet` |

---

## Project layout

```
src/
  app/
    layout.tsx                       # Petspective shell (header, footer, fonts)
    page.tsx                         # public homepage — featured + episode grid
    episode/[slug]/                  # public episode page
      page.tsx                       # show notes, transcript, listen links, Spotify embed
      transcript-player.tsx          # interactive transcript w/ entity link popovers
    admin/
      login/                         # email/password sign-in (enable 2FA in Supabase)
      (protected)/                   # gated by requireCreator()
        layout.tsx
        page.tsx                     # creator dashboard
        episodes/
          page.tsx                   # episode list + status
          new/page.tsx               # 4-step AI episode creator
    api/
      mailbag/route.ts               # public "Ask a Vet" submissions
      admin/episodes/                # creator-only CRUD + AI pipeline
        route.ts                     # list / create episode draft
        [id]/
          route.ts                   # update / delete / publish
          transcribe/route.ts        # Whisper → pet_podcast.transcripts
          show-notes/route.ts        # Gemini → pet_podcast.show_notes
          link-entities/route.ts     # Gemini → entity_links (transcript)
          image/route.ts             # DALL·E 3 → 4 thumbnail variants
          image/select/route.ts      # re-host chosen variant + set image_url
  lib/
    supabase/                        # admin / server / client — all pin db.schema='pet_podcast'
    ai/
      openai.ts                      # Whisper + chatJSON + DALL·E
      gemini.ts                      # show notes + entity link extraction
      learnings.ts                   # progressive-learning prompt augmentation
      learnings.json                 # editable, append-only style/preference store
    auth.ts                          # requireCreator() guard
    isolation.ts                     # assertPetSchema() / assertPetBucket() / BUCKETS
    listen-links.ts                  # Apple / Overcast / Pocket Casts / Castro / RSS
    podcastindex.ts                  # Podcast Index API client (signed)
    spotify.ts                       # share URL → embed URL
    types.ts
supabase/
  migrations/
    0001_pet_podcast_init.sql        # schema, 10 tables, RLS, helpers
    0002_transcript_entity_links.sql # entity_links jsonb on transcripts
    0003_episode_spotify_url.sql     # spotify_url on episodes
docs/
  agent-learnings.md                 # human-readable AI learnings log (see AGENTS.md)
AGENTS.md                            # Opus 4.7 prompting + self-learning contract
CONTRIBUTING.md                      # isolation contract (must read)
```

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Env vars
```bash
cp .env.example .env.local
# edit .env.local with rotated keys
```

Required entries are documented in [`.env.example`](.env.example) and recapped in [CONTRIBUTING.md](CONTRIBUTING.md).

### 3. Supabase migrations

Apply migrations in order. The preferred path is documented in [AGENTS.md](AGENTS.md#migrations); the short version:

```bash
# If SUPABASE_DB_URL is set in .env.local
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_pet_podcast_init.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0002_transcript_entity_links.sql
psql "$SUPABASE_DB_URL" -f supabase/migrations/0003_episode_spotify_url.sql
```

Then in the Supabase Dashboard:

1. **Settings → API → Exposed schemas:** add `pet_podcast` alongside `public`.
2. **Storage:** create
   - `pet-podcast-audio` — Private
   - `pet-podcast-images` — Public
3. **Create your admin user** via Supabase Auth, then promote in SQL:
   ```sql
   insert into pet_podcast.profiles (id, email, full_name, role)
   values ('<your-auth-uid>', 'you@example.com', 'Your Name', 'admin');
   ```

### 4. Dev server
```bash
npm run dev   # http://localhost:3000
npm run build # production build (also runs the isolation guard at module load)
npm run lint
npx tsc --noEmit
```

---

## Deployment — Vercel

1. Push to GitHub → import the repo into Vercel (Next.js auto-detected).
2. Paste every entry from `.env.example` into the Vercel project's environment variables.
3. Add the domains `www.podcast.pet` (primary) and `podcast.pet` (307 → www).

### GoDaddy DNS

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Delete the existing parked `A @` and any `CNAME www → podcast.pet.` entries before adding these. Vercel issues SSL automatically once DNS propagates.

---

## AI pipeline (admin → new episode)

1. **Step 1 — Draft.** Title, season, episode number → `POST /api/admin/episodes`.
2. **Step 2 — Audio.** Drag-drop MP3/WAV/M4A → uploaded to `pet-podcast-audio`; signed URL saved as `episodes.audio_url`.
3. **Step 3 — Transcript + show notes.**
   - `POST /api/admin/episodes/:id/transcribe` → Whisper → `pet_podcast.transcripts`.
   - `POST /api/admin/episodes/:id/show-notes` → Gemini 1.5 Pro → summary, 5 takeaways, chapters, SEO description, suggested image prompt → `pet_podcast.show_notes`.
   - `POST /api/admin/episodes/:id/link-entities` → Gemini → up to 20 entity links (Wikipedia / Merck / AVMA / Cornell / VCA / manufacturer) → `transcripts.entity_links`.
4. **Step 4 — Cover art.**
   - `POST /api/admin/episodes/:id/image` → DALL·E 3 → 4 variants.
   - `POST /api/admin/episodes/:id/image/select` → re-uploads the chosen variant into `pet-podcast-images` and sets `episodes.image_url`.
5. **Optionally attach Spotify.** Update `episodes.spotify_url` with any standard share URL — the page renders the official embed via `spotifyEmbedUrl()`.
6. **Publish.** `PATCH /api/admin/episodes/:id { status: 'published' }`.

Every Gemini-backed step automatically prepends the current `learnings.json` content as a `<learned_preferences>` block. See [AGENTS.md](AGENTS.md) for how to teach the system.

---

## Database isolation

Stoop Politics owns `public`. Petspective owns `pet_podcast` and **only** `pet_podcast`. Both apps share `auth.users`. Full rules — including a sortable list of forbidden tables and buckets — are in [CONTRIBUTING.md](CONTRIBUTING.md). The contract is enforced at module load by `assertPetSchema()` / `assertPetBucket()` in [`src/lib/isolation.ts`](src/lib/isolation.ts).

---

## Security checklist

- [ ] OpenAI / Gemini / Supabase / Podcast Index keys rotated whenever exposed
- [ ] `.env.local` not committed (`git status` clean)
- [ ] Supabase 2FA enabled on the project owner account
- [ ] Admin user has `role = 'admin'` in `pet_podcast.profiles`
- [ ] `pet-podcast-audio` is **private**, `pet-podcast-images` is **public read**
- [ ] All new tables enable RLS and use `pet_podcast.is_admin()` / `pet_podcast.is_creator()` policies

---

## License

UNLICENSED — internal Green Dog production.
# Pet Podcast 🐾

> **Real Vets. Real Advice. Real Pet Stories.**
> A premium veterinary podcast platform — built as a sister product to Stoop Politics, sharing the same Supabase project but isolated via a dedicated `pet_podcast` schema.

---

## ⚠️ Before you do anything else — rotate your keys

The OpenAI and Gemini API keys that were pasted into chat are **compromised**. Revoke them now:

- **OpenAI:** https://platform.openai.com/api-keys → delete the leaked `sk-proj-...` key
- **Gemini:** https://aistudio.google.com/app/apikey → delete the leaked `AIzaSy...` key

Then create new keys and put them only in `.env.local` (gitignored) and Vercel project env vars. Never paste keys into chat or commit them.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS — "Green Dog Aesthetic" (sage / clinical white) |
| Database & Auth | Supabase (project `cuxuqsnbxwuhdeajrjcz`, schema `pet_podcast`) |
| Storage | Supabase Storage (`pet-podcast-audio`, `pet-podcast-images`) |
| AI | OpenAI Whisper + GPT-4o-mini + DALL·E 3, Google Gemini 1.5 Pro |
| Hosting | Vercel @ `www.podcast.pet` |

## Project layout

```
src/
  app/
    page.tsx                       # public homepage (Clinic Floor)
    episode/[slug]/                # public episode detail page + sticky player
    admin/                         # gated creator dashboard
      login/                       # email/password sign-in (enable 2FA in Supabase)
      episodes/new/                # 4-step AI episode creator
    api/
      mailbag/                     # public "Ask a Vet" submissions
      admin/episodes/              # creator-only CRUD + AI pipeline endpoints
  lib/
    supabase/                      # admin (service role), server, browser clients
    ai/                            # openai.ts (Whisper, GPT, DALL·E), gemini.ts
    auth.ts                        # requireCreator() guard
    types.ts
supabase/
  migrations/0001_pet_podcast_init.sql   # schema, RLS, triggers, helpers
```

## Setup

### 1. Install
```bash
npm install
```

### 2. Env vars
```bash
cp .env.example .env.local
# edit .env.local with NEW (rotated) keys
```

### 3. Supabase migration
1. Open Supabase Dashboard → SQL Editor for project `cuxuqsnbxwuhdeajrjcz`.
2. Paste & run `supabase/migrations/0001_pet_podcast_init.sql`.
3. Go to **Settings → API → Exposed schemas** and add `pet_podcast` alongside `public`.
4. **Storage:** create two buckets:
   - `pet-podcast-audio` — Private
   - `pet-podcast-images` — Public
5. Create your admin user:
   - Sign up via Supabase Auth (Dashboard → Authentication → Users → "Add user").
   - Then promote yourself in SQL Editor:
     ```sql
     insert into pet_podcast.profiles (id, email, full_name, role)
     values ('<your-auth-uid>', 'you@example.com', 'Your Name', 'admin');
     ```

### 4. Dev server
```bash
npm run dev
```
Open http://localhost:3000.

## Deployment — Vercel

1. Push this repo to GitHub.
2. Import into Vercel → keep defaults (Next.js detected).
3. **Environment Variables:** paste every entry from `.env.example` with real values.
4. **Domain:** add `www.podcast.pet` and `podcast.pet`.

### GoDaddy DNS

In your GoDaddy DNS panel for `podcast.pet`:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Steps:
1. **Delete** the existing parked `A @` record.
2. **Delete** the existing `CNAME www → podcast.pet.` record (it loops without this).
3. Add the two records above.
4. Vercel will auto-issue SSL once DNS propagates.

## Database isolation strategy

Stoop Politics lives in `public`. Pet Podcast lives entirely in the `pet_podcast` schema:

- All Supabase clients in `src/lib/supabase/*` set `db.schema = 'pet_podcast'`, so `.from('episodes')` resolves to `pet_podcast.episodes` automatically.
- RLS is enabled on every table; public reads are limited to `status='published'` content.
- Helper functions `pet_podcast.is_admin()` and `pet_podcast.is_creator()` gate write access.

## AI pipeline (admin → new episode)

1. **Step 1:** create episode draft (title, season, ep #).
2. **Step 2:** drag-drop MP3/WAV/M4A → uploaded to `pet-podcast-audio` bucket; signed URL saved to `episodes.audio_url`.
3. **Step 3:**
   - `POST /api/admin/episodes/:id/transcribe` → Whisper verbose JSON → `pet_podcast.transcripts`.
   - `POST /api/admin/episodes/:id/show-notes` → Gemini 1.5 Pro → summary + 5 takeaways + chapters → `pet_podcast.show_notes`.
4. **Step 4:**
   - `POST /api/admin/episodes/:id/image` → DALL·E 3 → 4 thumbnail options.
   - `POST /api/admin/episodes/:id/image/select` → re-uploads the chosen URL into `pet-podcast-images` and sets `episodes.image_url`.
5. **Publish:** `PATCH /api/admin/episodes/:id { status: 'published' }`.

## Security checklist

- [ ] OpenAI key rotated
- [ ] Gemini key rotated
- [ ] `.env.local` not committed (verify with `git status`)
- [ ] Supabase 2FA enabled on the project owner account
- [ ] Admin user has `role = 'admin'` in `pet_podcast.profiles`
- [ ] Audio bucket is **private**; images bucket is **public read**

## License

UNLICENSED — internal Green Dog production.
# PetPodcast
Pet Podcast
