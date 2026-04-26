# Agent Learnings — Petspective

> Append-only log. Newest entries on top. Each entry should answer:
> **What was wrong → what we learned → what changed in `src/lib/ai/learnings.json`.**
>
> See [AGENTS.md §6](../AGENTS.md#6-the-progressive-learning-loop) for the full protocol.

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
