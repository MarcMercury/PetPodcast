// Progressive-learning loader for the Petspective AI pipeline.
// See AGENTS.md §6 — "The progressive-learning loop".
//
// Every Gemini-backed generator imports `learnedPreferencesBlock()` and embeds
// the result as a <learned_preferences> XML block in its system instruction,
// so any rule added to learnings.json takes effect on the next AI call without
// a code change.

import learnings from './learnings.json';

export interface Learnings {
  version: number;
  voice: string[];
  banned_phrases: string[];
  approved_entity_domains: string[];
  show_notes_rules: string[];
  image_prompt_rules: string[];
}

export function loadLearnings(): Learnings {
  return learnings as Learnings;
}

/** Format the current learnings as a single XML block to embed in a system prompt. */
export function learnedPreferencesBlock(scope?: keyof Learnings | (keyof Learnings)[]): string {
  const l = loadLearnings();
  const allKeys: (keyof Learnings)[] = [
    'voice',
    'banned_phrases',
    'approved_entity_domains',
    'show_notes_rules',
    'image_prompt_rules'
  ];
  const wanted = scope
    ? Array.isArray(scope) ? scope : [scope]
    : allKeys;

  const sections = wanted
    .map((key) => {
      const items = l[key];
      if (!Array.isArray(items) || items.length === 0) return null;
      const tag = String(key);
      const body = items.map((line) => `    <item>${escapeXml(String(line))}</item>`).join('\n');
      return `  <${tag}>\n${body}\n  </${tag}>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<learned_preferences version="${l.version}">\n${sections}\n</learned_preferences>`;
}

/** Quick allowlist check for entity-link domains. Subdomains are accepted. */
export function isApprovedDomain(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const allow = loadLearnings().approved_entity_domains.map((d) => d.toLowerCase());
  return allow.some((d) => host === d || host.endsWith(`.${d}`));
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
