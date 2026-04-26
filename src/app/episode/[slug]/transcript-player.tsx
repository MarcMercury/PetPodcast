'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EntityLink, TranscriptSegment } from '@/lib/types';

export interface Chapter {
  start: number;
  title: string;
}

export default function TranscriptPlayer({
  audioUrl,
  title,
  segments,
  chapters = [],
  entityLinks = []
}: {
  audioUrl: string;
  title: string;
  segments: TranscriptSegment[];
  chapters?: Chapter[];
  entityLinks?: EntityLink[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onT = () => setTime(a.currentTime);
    a.addEventListener('timeupdate', onT);
    return () => a.removeEventListener('timeupdate', onT);
  }, []);

  const skip = (delta: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = Math.max(0, a.currentTime + delta);
  };

  const setSpeed = (r: number) => {
    setRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const jump = (t: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = t;
    void audioRef.current.play();
  };

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.start - b.start),
    [chapters]
  );

  const activeChapterIdx = useMemo(() => {
    if (sortedChapters.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < sortedChapters.length; i++) {
      if (time >= sortedChapters[i].start) idx = i;
      else break;
    }
    return idx;
  }, [time, sortedChapters]);

  return (
    <>
      {/* Sticky player */}
      <div className="sticky top-16 z-30 mt-8 card p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => skip(-15)} className="btn-ghost py-1.5 text-xs" aria-label="Back 15 seconds">⏪ 15</button>
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="flex-1"
            aria-label={`Audio for ${title}`}
          />
          <button onClick={() => skip(30)} className="btn-ghost py-1.5 text-xs" aria-label="Forward 30 seconds">30 ⏩</button>
          <select
            value={rate}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="rounded-full border border-sage-700 bg-ink-soft text-cream px-3 py-1.5 text-xs"
            aria-label="Playback speed"
          >
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
              <option key={r} value={r}>{r}×</option>
            ))}
          </select>
        </div>

        {sortedChapters.length > 0 && (
          <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto pb-1" aria-label="Episode chapters">
            {sortedChapters.map((c, i) => {
              const isActive = i === activeChapterIdx;
              return (
                <button
                  key={`${c.start}-${i}`}
                  onClick={() => jump(c.start)}
                  className={[
                    'shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs transition border',
                    isActive
                      ? 'bg-sage-300 text-ink border-sage-300 shadow-sm'
                      : 'bg-ink-soft border-bone text-sage-200 hover:border-sage-500 hover:text-cream'
                  ].join(' ')}
                >
                  <span className={`font-mono ${isActive ? 'text-ink/70' : 'text-sage-400'}`}>
                    {formatTime(c.start)}
                  </span>
                  <span className="font-medium">{c.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* References — AI-extracted entity links */}
      {entityLinks.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">References</p>
          <h2 className="mt-2 text-2xl font-display font-bold tracking-tight">In this episode</h2>
          <ul className="mt-4 grid sm:grid-cols-2 gap-3">
            {entityLinks.map((e, i) => (
              <li key={`${e.term}-${i}`} className="card p-4">
                <div className="flex items-baseline gap-2">
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-cream hover:text-sage-300 underline-offset-4 hover:underline"
                  >
                    {e.term}
                  </a>
                  <span className="chip text-[10px]">{e.type}</span>
                </div>
                {e.description && (
                  <p className="mt-1 text-sm text-sage-200 leading-snug">{e.description}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Transcript */}
      {segments.length > 0 && (
        <section className="mt-10">
          <p className="eyebrow">Optional reading view</p>
          <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-2xl font-display font-bold tracking-tight">Transcript</h2>
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="btn-ghost text-xs"
              aria-expanded={showTranscript}
            >
              {showTranscript ? 'Hide transcript' : 'Show transcript'}
            </button>
          </div>
          <p className="mt-1 text-sm text-sage-300">
            Off by default. Key subjects link out to trusted references.
          </p>
          {showTranscript && (
            <TranscriptBody segments={segments} entityLinks={entityLinks} jump={jump} />
          )}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Transcript body — does NOT auto-follow the audio. Key subjects from the
// AI-extracted entityLinks are auto-linked inline (first occurrence only,
// case-insensitive) so listeners can dive into outside references.
// ---------------------------------------------------------------------------

function TranscriptBody({
  segments,
  entityLinks,
  jump
}: {
  segments: TranscriptSegment[];
  entityLinks: EntityLink[];
  jump: (t: number) => void;
}) {
  const linker = useMemo(() => buildLinker(entityLinks), [entityLinks]);
  const linkedSoFar = new Set<string>();

  return (
    <div className="mt-4 space-y-2 max-h-[600px] overflow-y-auto pr-2 leading-relaxed">
      {segments.map((s, i) => (
        <div key={i} className="rounded-lg px-3 py-2 hover:bg-sage-700/30">
          <button
            onClick={() => jump(s.start)}
            className="text-xs text-sage-400 font-mono mr-3 hover:text-sage-200"
            aria-label={`Jump to ${formatTime(s.start)}`}
          >
            {formatTime(s.start)}
          </button>
          <span className="text-cream">
            {renderWithLinks(s.text, linker, linkedSoFar)}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Linker {
  regex: RegExp | null;
  byKey: Map<string, EntityLink>;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLinker(links: EntityLink[]): Linker {
  if (!links?.length) return { regex: null, byKey: new Map() };
  const byKey = new Map<string, EntityLink>();
  for (const l of links) byKey.set(l.term.toLowerCase(), l);
  // Longest-first so multi-word terms beat single-word substrings.
  const terms = [...links]
    .map((l) => l.term)
    .filter((t) => t && t.trim().length > 1)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex);
  if (terms.length === 0) return { regex: null, byKey };
  const regex = new RegExp(`\\b(${terms.join('|')})\\b`, 'gi');
  return { regex, byKey };
}

function renderWithLinks(
  text: string,
  linker: Linker,
  linkedSoFar: Set<string>
): React.ReactNode {
  if (!linker.regex) return text;
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  linker.regex.lastIndex = 0;
  while ((match = linker.regex.exec(text)) !== null) {
    const [hit] = match;
    const key = hit.toLowerCase();
    const entity = linker.byKey.get(key);
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    if (entity && !linkedSoFar.has(key)) {
      linkedSoFar.add(key);
      out.push(
        <a
          key={`${key}-${match.index}`}
          href={entity.url}
          target="_blank"
          rel="noopener noreferrer"
          title={entity.description ?? `${entity.type} · opens in new tab`}
          className="underline decoration-dotted decoration-sage-400 underline-offset-4 text-sage-300 hover:text-cream hover:decoration-solid"
        >
          {hit}
        </a>
      );
    } else {
      out.push(hit);
    }
    lastIndex = match.index + hit.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}
