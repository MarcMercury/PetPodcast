'use client';
import { useEffect, useRef, useState } from 'react';
import type { TranscriptSegment } from '@/lib/types';

export default function TranscriptPlayer({
  audioUrl,
  title,
  segments
}: {
  audioUrl: string;
  title: string;
  segments: TranscriptSegment[];
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);

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
    audioRef.current.play();
  };

  return (
    <>
      {/* Sticky player */}
      <div className="sticky top-16 z-30 mt-8 card p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => skip(-15)} className="btn-ghost py-1.5 text-xs">⏪ 15</button>
          <audio
            ref={audioRef}
            src={audioUrl}
            controls
            className="flex-1"
            aria-label={`Audio for ${title}`}
          />
          <button onClick={() => skip(30)} className="btn-ghost py-1.5 text-xs">30 ⏩</button>
          <select
            value={rate}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="rounded-full border border-sage-300 px-3 py-1.5 text-xs bg-white"
            aria-label="Playback speed"
          >
            {[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => (
              <option key={r} value={r}>{r}×</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transcript */}
      {segments.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl font-bold">Transcript</h2>
          <div className="mt-4 space-y-1 max-h-[500px] overflow-y-auto pr-2">
            {segments.map((s, i) => {
              const active = time >= s.start && time < s.end;
              return (
                <button
                  key={i}
                  onClick={() => jump(s.start)}
                  className={`w-full text-left rounded-lg px-3 py-2 transition ${
                    active ? 'bg-sage-100 text-sage-900' : 'hover:bg-sage-50 text-sage-700'
                  }`}
                >
                  <span className="text-xs text-sage-500 font-mono mr-3">
                    {formatTime(s.start)}
                  </span>
                  {s.text}
                </button>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}
