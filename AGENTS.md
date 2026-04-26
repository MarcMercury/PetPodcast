# AGENTS.md — Petspective Agent Contract

> **You are an AI coding agent (Copilot / Claude / Cursor / etc.) working in the Petspective repo.**
> This file is the source of truth for *how* to work here. Read it in full before your first edit.
> It is also the spec for the AI runtime that produces show notes, entity links, and cover art —
> those generators read [`src/lib/ai/learnings.json`](src/lib/ai/learnings.json) on every call so the
> system gets smarter every time a human teaches it something new.

---

## Table of contents

1. [What this repo is](#1-what-this-repo-is)
2. [Operating principles (Opus 4.7-style)](#2-operating-principles-opus-47-style)
3. [Hard guardrails — do not violate](#3-hard-guardrails--do-not-violate)
4. [Effort levels & when to use them](#4-effort-levels--when-to-use-them)
5. [Prompt scaffolding (XML you should reuse)](#5-prompt-scaffolding-xml-you-should-reuse)
6. [The progressive-learning loop](#6-the-progressive-learning-loop)
7. [Workflows](#7-workflows)
8. [Migrations](#8-migrations)
9. [Testing & verification](#9-testing--verification)
10. [Failure modes seen in this repo](#10-failure-modes-seen-in-this-repo)

---

## 1. What this repo is

Petspective is a Next.js 14 (App Router) + TypeScript + Supabase app. Public listener experience under `/`, gated creator tooling under `/admin`. AI pipeline turns raw audio into a transcript, show notes, entity-linked transcript player, and 4-up cover art.

- Listener brand: **Petspective**. Internal namespace: `pet_podcast`. The two are not interchangeable — see [CONTRIBUTING.md](CONTRIBUTING.md#brand-vs-namespace).
- Shares Supabase project with **Stoop Politics**. Isolation is non-negotiable — see [CONTRIBUTING.md](CONTRIBUTING.md#the-isolation-contract).
- Production: <https://www.podcast.pet>.

---

## 2. Operating principles (Opus 4.7-style)

These are calibrated for Claude Opus 4.7, but they translate directly to GPT-4-class and Gemini-1.5-class models too. Apply all of them by default.

### 2.1 Front-load intent in the first message

When you receive (or write) a prompt, every prompt should answer **task / constraints / success criteria / format / context** up front. Do not lazily start with "write a thing" and refine over five turns — that fragments planning and wastes tokens. If the user gave a thin prompt, infer the most useful action and *act*; do not ping-pong asking for clarifications you can derive from the codebase.

### 2.2 Delegate the full task without interrupting yourself

Plan before you code. Then execute the whole task. Don't pause halfway to ask permission for reversible local actions (file edits, test runs, build). **Confirm before destructive ops** — `git push --force`, `git reset --hard`, `rm -rf`, `drop table`, deleting branches, deleting files that look like in-progress work, anything that mutates production data. See `<operationalSafety>` in your system prompt.

### 2.3 Be literal, not creative, with instructions

Opus 4.7 follows instructions literally. You should too. If a task says "fix the heading on the episode page", do not also restyle the footer and refactor `transcript-player.tsx`. Match solution complexity to problem complexity.

> Don't add docstrings, comments, type annotations, error handling, helpers, or "while I'm here" cleanup to code you didn't have to change.

### 2.4 Calibrate verbosity to task complexity

Simple ask → short answer. Complex multi-file refactor → planned, sectioned answer. When in doubt, write less; the user can ask for more.

### 2.5 Investigate before claiming

Never speculate about code you have not opened. Never invent a URL, a Supabase column, a function name, or a stat. If a fact is verifiable in this repo, verify it before stating it. If it is verifiable on the web (auth APIs, library versions), say so and link the source.

### 2.6 Parallelize independent reads

If you need to read three files and they don't depend on each other, read them in one tool batch. Same for independent searches. Sequential tool calls are only correct when the next call depends on the previous result.

### 2.7 Implement, don't suggest

Default to making the change. The user can revert. They cannot un-read a wishy-washy "you could try…" answer.

---

## 3. Hard guardrails — do not violate

Anything in this section is grounds for the agent's output to be reverted wholesale.

1. **Schema isolation.** Never write SQL or code that targets `public.*` tables. Pet Podcast lives in `pet_podcast.*` only. The startup guard `assertPetSchema()` in [`src/lib/isolation.ts`](src/lib/isolation.ts) will throw if you tamper with it.
2. **Bucket isolation.** Only `pet-podcast-audio` and `pet-podcast-images`. Never `media`, `podcast-media`, or any other bucket. Use `BUCKETS.audio` / `BUCKETS.images`.
3. **Supabase clients.** Only construct Supabase clients via the helpers in [`src/lib/supabase/`](src/lib/supabase/). Never call `createClient` / `createBrowserClient` / `createServerClient` directly anywhere else.
4. **Service role key is server-only.** It can run DDL via `psql` direct connection, but the *Supabase REST/data* API will not run DDL — don't try. For migrations, use `psql "$SUPABASE_DB_URL"` (see §8).
5. **Secrets stay in `.env.local` / Vercel.** No keys in code, in commits, in chat, in tests, in fixtures, in docs.
6. **No Resend.** PetPodcast does not use Resend. The user cancelled it. Do not suggest it. Auth email goes through Supabase's built-in SMTP.
7. **RLS on every new table.** Every `pet_podcast.*` table must `enable row level security` and have policies that use `pet_podcast.is_admin()` / `pet_podcast.is_creator()`.
8. **Brand layer.** Listener-facing strings say "Petspective". Internal/database/bucket strings stay `pet_podcast`. Do not unify them.

---

## 4. Effort levels & when to use them

Petspective code work spans the full range. Pick deliberately:

| Effort | Use it for |
|---|---|
| **max** | Migrations that span schemas, security-sensitive RLS rewrites, cross-cutting refactors of the AI pipeline. Set a generous output budget; max can overthink. |
| **xhigh** *(default)* | New API routes, new admin pages, schema changes, anything that touches the isolation guard, anything that ships to `www.podcast.pet`. |
| **high** | Targeted bug fixes, single-file UI tweaks, prompt improvements that need testing. |
| **medium** | Renames, doc edits, copy changes, README/CONTRIBUTING updates. |
| **low** | Reserve for trivially scoped string replacements. Risk: shallow reasoning. |

When in doubt, default to **xhigh**. Adaptive thinking will scale down on easy steps automatically; it will not scale up on hard ones if you cap effort low.

---

## 5. Prompt scaffolding (XML you should reuse)

Use this skeleton anywhere you build a prompt — Cursor instructions, Copilot custom instructions, system prompts for `chatJSON`, or `systemInstruction` for Gemini. Tags eliminate ambiguity between *instructions*, *context*, *examples*, and *learned preferences*. Opus 4.7-class models follow tagged sections with high fidelity.

```xml
<role>
  Brief description of who the model is acting as in this call.
</role>

<task>
  The single, concrete thing to produce. Match output verbosity to complexity.
</task>

<constraints>
  - Hard limits (length, schema, banned phrases).
  - "Do X" framings only — never "do not Y" without an X.
</constraints>

<format>
  Strict output shape. If JSON, give the TypeScript type.
</format>

<examples>
  <example>...one ideal output...</example>
</examples>

<learned_preferences>
  Inject src/lib/ai/learnings.json here at runtime — see §6.
</learned_preferences>

<input>
  The actual transcript / file / question.
</input>
```

The Gemini show-notes and entity-link prompts already follow this shape. When you add a new AI call, follow it too.

---

## 6. The progressive-learning loop

> This is the "self-learning" half of the contract. The site gets smarter every time a human corrects it.

### 6.1 Two stores, one purpose

| Store | Path | Audience | What it holds |
|---|---|---|---|
| **Runtime store** | [`src/lib/ai/learnings.json`](src/lib/ai/learnings.json) | The model (read at every AI call) | Style rules, banned phrases, approved entity domains, voice corrections — distilled to a single short JSON. |
| **Human log** | [`docs/agent-learnings.md`](docs/agent-learnings.md) | Future contributors & agents | Append-only narrative: *what was wrong, what we learned, what we changed in `learnings.json`*. |

Every Gemini-backed generator (`generateShowNotes`, `extractEntityLinks`) calls `loadLearnings()` from [`src/lib/ai/learnings.ts`](src/lib/ai/learnings.ts) and injects it as a `<learned_preferences>` block into the system instruction. Whatever you add to `learnings.json` takes effect immediately on the next episode generated.

### 6.2 The loop

```
1. Generate                 → AI produces show notes / entity links / image prompt.
2. Review                   → Human edits the output in /admin.
3. Diff                     → If a recurring pattern shows up, distill it.
4. Teach                    → Append a rule to learnings.json + a paragraph to docs/agent-learnings.md.
5. Next run uses the rule   → No code change required; the rule is in the prompt.
```

### 6.3 What belongs in `learnings.json`

Add a new entry **only when** you've seen the same correction at least twice, *or* the correction is a brand/legal hard rule that can't be allowed to recur even once.

Schema (kept intentionally tiny so it always fits in the prompt window):

```jsonc
{
  "version": "<incrementing integer>",
  "voice": [
    "Short imperative sentences. Do this. Avoid that."
  ],
  "banned_phrases": [
    "exact strings that must never appear in show notes"
  ],
  "approved_entity_domains": [
    "wikipedia.org", "merckvetmanual.com", "avma.org", "..."
  ],
  "show_notes_rules": [
    "Call vets 'Dr. <Last>' on first reference, '<Last>' afterwards.",
    "Never give a specific dose; defer to 'ask your vet'."
  ],
  "image_prompt_rules": [
    "No human faces. No text in images. Sage / cream / ink palette only."
  ]
}
```

### 6.4 Etiquette for editing the loop

- **Append, don't rewrite history.** `docs/agent-learnings.md` is a log. New entries go on top, dated, with a one-line "rule added to `learnings.json`" pointer.
- **Distill, don't novelize.** `learnings.json` rules are imperatives, ≤ 20 words each. If you can't compress it, it doesn't belong in the runtime store.
- **Bump `version`.** It exists so future tooling can cache-bust.
- **Remove rules that fire wrongly.** A bad rule is worse than no rule. If a rule causes a regression, delete it from `learnings.json` and explain in the log.

### 6.5 If you're an agent and a human just corrected you

Run this checklist:

1. Was the correction a *one-off taste call*? → Don't teach. Just apply it this time.
2. Was it a *recurring style/voice/safety pattern*? → Add a rule to `learnings.json` and a log entry to `docs/agent-learnings.md`. Bump `version`.
3. Was it a *factual error you invented*? → Add an investigation-first reminder to `voice[]` and log the specific hallucination.
4. Was it about a *banned URL or untrusted source*? → Tighten `approved_entity_domains[]` (allowlist) — *don't* add a denylist; allowlists are bounded, denylists drift.

---

## 7. Workflows

### 7.1 New feature

1. Create the migration first if data shape is changing — `supabase/migrations/000N_<feature>.sql`. Schema = `pet_podcast.*`. RLS on. Apply with `psql` (see §8).
2. Add types to [`src/lib/types.ts`](src/lib/types.ts).
3. Server reads → `supabaseAdmin` for `/admin/(protected)/*`, `createSupabaseServer()` for public pages with RLS.
4. API routes → guard with `requireCreator()` from [`src/lib/auth.ts`](src/lib/auth.ts).
5. Storage → only `BUCKETS.audio` / `BUCKETS.images` from [`src/lib/isolation.ts`](src/lib/isolation.ts).
6. Run `npx tsc --noEmit` and `npm run build`. The isolation guard runs at module load — schema/bucket drift fails fast.

### 7.2 Touching the AI pipeline

1. Read the current prompt in [`src/lib/ai/gemini.ts`](src/lib/ai/gemini.ts) or [`src/lib/ai/openai.ts`](src/lib/ai/openai.ts). Don't speculate about it.
2. Keep the `<role>/<task>/<constraints>/<format>/<examples>/<learned_preferences>/<input>` shape.
3. If you add a new AI call, inject `loadLearnings()` so it inherits the progressive-learning loop.
4. Test with one real episode before merging. Show the diff to a human.

### 7.3 Editing copy

Keep listener-visible strings in the **Petspective** voice: clinical-yet-warm, no jargon without payoff, no marketing fluff. Internal docs (this file, CONTRIBUTING, migrations) can stay literal/technical.

---

## 8. Migrations

Per the user's standing workflow preference (recorded in agent memory):

1. **Preferred:** if `SUPABASE_DB_URL` is in `.env.local`:
   ```bash
   psql "$SUPABASE_DB_URL" -f supabase/migrations/000N_<file>.sql
   ```
2. **Fallback:** if `SUPABASE_ACCESS_TOKEN` is set and the Supabase CLI is linked:
   ```bash
   npx supabase db push
   ```
3. **If neither is configured:** stop and ask the user for the missing secret. Do not guess. Do not paste service role keys; they don't run DDL through the data API anyway.

When you add or change a migration file, **push it for the user**. Don't write the SQL and stop.

---

## 9. Testing & verification

This repo doesn't have a unit test suite (yet). The verification gate before any merge:

```bash
npx tsc --noEmit         # typecheck
npm run lint             # eslint
npm run build            # next build — also runs assertPetSchema() at module load
```

If you change a prompt, also run one real episode through the pipeline locally and eyeball the output. If you change RLS, also confirm read access from an unauthenticated browser session.

---

## 10. Failure modes seen in this repo

A non-exhaustive list. The point of writing this down is so the next agent doesn't repeat them.

- **Cross-schema bleed.** An agent referenced `public.episodes` once. The isolation guard caught it at build. Don't repeat — Stoop Politics has a same-named table and you will *silently corrupt their data* if the guard is bypassed.
- **Wrong client constructor.** Calling `createBrowserClient()` directly instead of going through `src/lib/supabase/client.ts` skips the schema pin. Always go through the helpers.
- **Reinventing email.** Resend was tried and cancelled. Do not propose a transactional-email provider unless the user explicitly asks.
- **Hallucinated entity URLs.** Gemini occasionally invents Merck Manual URLs that 404. The `extractEntityLinks` post-processor enforces `https:` + dedupe, but the *real* fix lives in `learnings.json → approved_entity_domains`. Tighten the allowlist when you see a bad domain slip through.
- **Service-role-key migrations.** The service role key is for the *data* API, not DDL. DDL goes through `psql` (preferred) or `supabase db push`.
- **Renaming the schema/bucket.** Do not. The names `pet_podcast`, `pet-podcast-audio`, `pet-podcast-images` are the wall between us and Stoop Politics. The brand can change; the wall cannot.

---

*If you taught the system something new in this session, append a dated entry to [`docs/agent-learnings.md`](docs/agent-learnings.md) and reflect it in [`src/lib/ai/learnings.json`](src/lib/ai/learnings.json) before you sign off.*
