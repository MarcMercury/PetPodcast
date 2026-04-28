# Agent Learnings — Petspective

> Append-only log. Newest entries on top. Each entry should answer:
> **What was wrong → what we learned → what changed in `src/lib/ai/learnings.json`.**
>
> See [AGENTS.md §6](../AGENTS.md#6-the-progressive-learning-loop) for the full protocol.

---

# Agent Learnings — Petspective

> Append-only log. Newest entries on top. Each entry should answer:
> **What was wrong → what we learned → what changed in `src/lib/ai/learnings.json`.**
>
> See [AGENTS.md §6](../AGENTS.md#6-the-progressive-learning-loop) for the full protocol.

---

## 2026-04-28 — Studio shipped (no learnings.json change)

**What was wrong.** Editing was happening in Audition / external tools after the AI pipeline ran, which broke the loop: hand-edits to the audio drifted from the timestamps the transcript / show-notes / chapters were anchored to.

**What we learned.** The studio belongs *inside* `/admin` so cuts and chapters are authored against the same word-level timestamps Whisper returns. New surface:
- Migration `0005_studio.sql` adds `transcripts.words` (word-level timestamps) and `pet_podcast.studio_projects`.
- `src/lib/auphonic.ts` wraps the Auphonic API for one-click loudness/denoise polish (-16 LUFS).
- `/admin/episodes/[id]/studio` — WaveSurfer waveform with drag-to-cut regions, transcript pane (click-to-scrub, shift-click to cut a word range), chapter markers, intro/outro slots, in-browser ffmpeg.wasm render.
- Phone video → audio extraction also runs client-side via ffmpeg.wasm so `pet-podcast-audio` is the only bucket touched (isolation contract preserved; no new bucket added).

**What changed in `learnings.json`.** Nothing — this is infra, not a content rule. If editing surfaces a recurring chapter-naming or cut-rationale pattern, we'll add a `show_notes_rules[]` entry then.

**New env vars.** `AUPHONIC_API_KEY` (server-only). Keep it in `.env.local` and Vercel; do not commit.

---

## 2026-04-26 — Initial seed

**What was wrong.** Nothing yet — this file and `learnings.json` are being introduced today. Before this, every Gemini call started from a fixed system prompt with no memory of prior corrections, so the same voice / banned-domain mistakes had to be re-fixed by hand on every episode.

**What we learned.** The AI pipeline needs a single small JSON file the model reads on every call, plus a human-readable log next to it explaining *why* each rule exists. Without the "why", future agents will delete rules they don't understand.

**What changed.**

- Added [`src/lib/ai/learnings.json`](../src/lib/ai/learnings.json) with starter rules distilled from the existing prompts in [`src/lib/ai/gemini.ts`](../src/lib/ai/gemini.ts):
  - Voice: clinical-yet-warm, "Doctor's Note" style.
  - Banned phrases: marketing fluff that has slipped in before (`"game-changer"`, `"cutting-edge"`, `"revolutionary"`, `"in today's fast-paced world"`).
  - Approved entity domains: Wikipedia, Merck Vet Manual, AVMA, AAHA, FDA-CVM, NIH, Cornell, VCA Hospitals.
  - Show-notes rules: never quote a specific dose; defer to "ask your vet".
  - Image-prompt rules: no human faces, no in-image text, sage / cream / ink palette only.
- Added [`src/lib/ai/learnings.ts`](../src/lib/ai/learnings.ts) with `loadLearnings()` and `learnedPreferencesBlock()`.
- Wired both into `generateShowNotes` and `extractEntityLinks` via a `<learned_preferences>` XML block in the system instruction.

**Version bumped to:** `1`.
