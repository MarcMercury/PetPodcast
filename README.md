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
