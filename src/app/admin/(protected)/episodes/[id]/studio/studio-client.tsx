'use client';

// Petspective Studio — in-browser audio editor.
//
//  ┌──────────────────────────────────────────────────────────────────────┐
//  │ Source picker   Waveform (cuts + chapter markers)        Transport   │
//  │ Transcript (click word → scrub, shift-click → mark cut range)        │
//  │ Right rail: chapters list, intro/outro slots, polish, render, ship   │
//  └──────────────────────────────────────────────────────────────────────┘
//
// Heavy deps (wavesurfer.js, ffmpeg.wasm) load only when needed.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import type {
  StudioCut,
  StudioChapter,
  TranscriptWord,
  AuphonicStatus
} from '@/lib/types';

type Initial = {
  episode: { id: string; title: string; audio_url: string | null };
  transcript: {
    raw_text: string | null;
    segments: { start: number; end: number; text: string }[];
    words: TranscriptWord[];
    language: string | null;
  } | null;
  project: {
    cuts: StudioCut[];
    chapters: StudioChapter[];
    intro_path: string | null;
    outro_path: string | null;
    auphonic_uuid: string | null;
    auphonic_status: AuphonicStatus;
    polished_audio_path: string | null;
    final_audio_path: string | null;
  };
  urls: {
    source: string | null;
    polished: string | null;
    final: string | null;
    intro: string | null;
    outro: string | null;
  };
  paths: { source: string | null };
};

type SourceKind = 'source' | 'polished' | 'final';

export default function StudioClient({
  episodeId,
  episodeTitle,
  audioBucket,
  initial
}: {
  episodeId: string;
  episodeTitle: string;
  audioBucket: string;
  initial: Initial | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowser(), []);
  const waveContainer = useRef<HTMLDivElement | null>(null);

  // Editor state ---------------------------------------------------
  const [data, setData] = useState<Initial | null>(initial);
  const [sourceKind, setSourceKind] = useState<SourceKind>(
    initial?.urls.polished ? 'polished' : 'source'
  );
  const [cuts, setCuts] = useState<StudioCut[]>(initial?.project.cuts ?? []);
  const [chapters, setChapters] = useState<StudioChapter[]>(initial?.project.chapters ?? []);
  const [duration, setDuration] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [auphonicStatus, setAuphonicStatus] = useState<AuphonicStatus>(
    initial?.project.auphonic_status ?? null
  );

  const wsRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);

  const sourceUrl = useMemo(() => {
    if (sourceKind === 'polished') return data?.urls.polished ?? null;
    if (sourceKind === 'final') return data?.urls.final ?? null;
    return data?.urls.source ?? null;
  }, [sourceKind, data]);

  // Wavesurfer mount -----------------------------------------------
  useEffect(() => {
    let cancelled = false;
    if (!waveContainer.current || !sourceUrl) return;
    (async () => {
      const [{ default: WaveSurfer }, { default: RegionsPlugin }] = await Promise.all([
        import('wavesurfer.js'),
        import('wavesurfer.js/dist/plugins/regions.esm.js')
      ]);
      if (cancelled || !waveContainer.current) return;

      // Tear down previous instance if reloading audio.
      if (wsRef.current) {
        try { wsRef.current.destroy(); } catch {}
        wsRef.current = null;
      }

      const regions = RegionsPlugin.create();
      const ws = WaveSurfer.create({
        container: waveContainer.current,
        height: 96,
        waveColor: '#9ab39e',
        progressColor: '#3f6d4e',
        cursorColor: '#1f3a26',
        url: sourceUrl,
        plugins: [regions]
      });
      wsRef.current = ws;
      regionsRef.current = regions;

      ws.on('ready', () => {
        const d = ws.getDuration();
        setDuration(d);
        // Hydrate existing cuts as draggable regions.
        for (const c of cuts) {
          regions.addRegion({
            start: c.start,
            end: c.end,
            color: 'rgba(220,38,38,0.25)',
            drag: true,
            resize: true,
            content: 'cut'
          });
        }
      });
      ws.on('timeupdate', (t: number) => setPlayhead(t));

      // Drag-to-create a new cut region.
      regions.enableDragSelection({ color: 'rgba(220,38,38,0.25)' });
      regions.on('region-created', () => syncCutsFromRegions());
      regions.on('region-updated', () => syncCutsFromRegions());
      regions.on('region-removed', () => syncCutsFromRegions());
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally do NOT depend on `cuts` — region-* events keep them in sync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  const syncCutsFromRegions = useCallback(() => {
    const r = regionsRef.current;
    if (!r) return;
    const next: StudioCut[] = r
      .getRegions()
      .map((reg: any) => ({ start: reg.start, end: reg.end }))
      .sort((a: StudioCut, b: StudioCut) => a.start - b.start);
    setCuts(next);
  }, []);

  // Transport ------------------------------------------------------
  const togglePlay = () => wsRef.current?.playPause();
  const seekTo = (t: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    const d = ws.getDuration();
    if (d > 0) ws.seekTo(Math.min(Math.max(t / d, 0), 1));
  };

  // Transcript click → scrub. Shift-click → mark cut range from anchor.
  const onWordClick = (w: TranscriptWord, e: React.MouseEvent) => {
    if (e.shiftKey && selectionAnchor !== null) {
      const start = Math.min(selectionAnchor, w.start);
      const end = Math.max(selectionAnchor, w.end);
      const r = regionsRef.current;
      if (r) {
        r.addRegion({
          start,
          end,
          color: 'rgba(220,38,38,0.25)',
          drag: true,
          resize: true,
          content: 'cut'
        });
      }
      setSelectionAnchor(null);
    } else {
      setSelectionAnchor(w.start);
      seekTo(w.start);
    }
  };

  // Chapter markers ------------------------------------------------
  const addChapterAtPlayhead = () => {
    const title = window.prompt('Chapter title?')?.trim();
    if (!title) return;
    setChapters((c) =>
      [...c, { time: playhead, title }].sort((a, b) => a.time - b.time)
    );
  };

  const removeChapter = (idx: number) =>
    setChapters((c) => c.filter((_, i) => i !== idx));

  // Save project state --------------------------------------------
  const saveProject = async (extra: Record<string, unknown> = {}) => {
    setBusy('Saving…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/studio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuts, chapters, ...extra })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'save failed');
      setStatus('Saved.');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  // Intro / outro upload ------------------------------------------
  const uploadAux = async (kind: 'intro' | 'outro', file: File) => {
    setBusy(`Uploading ${kind}…`);
    setErr(null);
    try {
      const path = `${episodeId}/${kind}.${file.name.split('.').pop() || 'mp3'}`;
      const { error } = await supabase.storage
        .from(audioBucket)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      await saveProject({ [`${kind}_path`]: path });
      // Reload signed URLs.
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    const res = await fetch(`/api/admin/episodes/${episodeId}/studio`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  };

  // Polish (Auphonic) ---------------------------------------------
  const startPolish = async () => {
    setBusy('Sending to Auphonic…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/studio/polish`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setAuphonicStatus('queued');
      pollPolish();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  const pollPolish = useCallback(async () => {
    const tick = async (): Promise<void> => {
      const res = await fetch(`/api/admin/episodes/${episodeId}/studio/polish`, { cache: 'no-store' });
      const j = await res.json();
      if (j.status) setAuphonicStatus(j.status);
      if (j.status === 'done') {
        await refresh();
        setStatus('Polish complete. Switch source to "Polished" to use it.');
        return;
      }
      if (j.status === 'error') {
        setErr('Auphonic returned error.');
        return;
      }
      setTimeout(tick, 5000);
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  useEffect(() => {
    if (auphonicStatus === 'queued' || auphonicStatus === 'processing') pollPolish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render (ffmpeg.wasm in-browser) -------------------------------
  const render = async (promote: boolean) => {
    if (!sourceUrl) return setErr('No source audio.');
    setBusy('Loading ffmpeg…');
    setErr(null);
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      const ff = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/umd';
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });

      setBusy('Fetching audio…');
      await ff.writeFile('source.mp3', await fetchFile(sourceUrl));
      const introUrl = data?.urls.intro;
      const outroUrl = data?.urls.outro;
      if (introUrl) await ff.writeFile('intro.mp3', await fetchFile(introUrl));
      if (outroUrl) await ff.writeFile('outro.mp3', await fetchFile(outroUrl));

      // Build the aselect expression that KEEPS the gaps between cuts.
      const sortedCuts = [...cuts].sort((a, b) => a.start - b.start);
      const keep: [number, number][] = [];
      let cursor = 0;
      for (const c of sortedCuts) {
        if (c.start > cursor) keep.push([cursor, c.start]);
        cursor = Math.max(cursor, c.end);
      }
      if (cursor < duration) keep.push([cursor, duration]);
      const aselect =
        keep.length === 0
          ? `between(t,0,${duration})`
          : keep.map(([a, b]) => `between(t,${a.toFixed(3)},${b.toFixed(3)})`).join('+');

      setBusy('Cutting…');
      await ff.exec([
        '-i', 'source.mp3',
        '-af', `aselect='${aselect}',asetpts=N/SR/TB`,
        '-ar', '44100', '-ac', '2', '-b:a', '128k',
        'cut.mp3'
      ]);

      let finalName = 'cut.mp3';
      const inputs: string[] = [];
      const filterParts: string[] = [];
      let n = 0;
      if (introUrl) { inputs.push('-i', 'intro.mp3'); filterParts.push(`[${n++}:a]`); }
      inputs.push('-i', 'cut.mp3'); filterParts.push(`[${n++}:a]`);
      if (outroUrl) { inputs.push('-i', 'outro.mp3'); filterParts.push(`[${n++}:a]`); }

      if (introUrl || outroUrl) {
        setBusy('Stitching intro/outro…');
        await ff.exec([
          ...inputs,
          '-filter_complex', `${filterParts.join('')}concat=n=${n}:v=0:a=1[out]`,
          '-map', '[out]',
          '-ar', '44100', '-ac', '2', '-b:a', '128k',
          'final.mp3'
        ]);
        finalName = 'final.mp3';
      }

      setBusy('Uploading final…');
      const out = (await ff.readFile(finalName)) as Uint8Array;
      // Copy to a tight ArrayBuffer to satisfy BlobPart in strict TS targets.
      const buf = new ArrayBuffer(out.byteLength);
      new Uint8Array(buf).set(out);
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const path = `${episodeId}/final.mp3`;
      const { error } = await supabase.storage.from(audioBucket).upload(path, blob, { upsert: true });
      if (error) throw error;

      const res = await fetch(`/api/admin/episodes/${episodeId}/studio/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_audio_path: path, promote })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setStatus(
        promote ? 'Rendered & promoted to published audio.' : 'Rendered. Preview from the Source picker.'
      );
      await refresh();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  // Replace source from a phone video (extract audio in-browser) --
  const replaceFromVideo = async (file: File) => {
    setBusy('Loading ffmpeg…');
    setErr(null);
    try {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      const ff = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/umd';
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });
      setBusy('Extracting audio…');
      await ff.writeFile('in.mp4', await fetchFile(file));
      await ff.exec([
        '-i', 'in.mp4',
        '-vn',
        '-ar', '44100', '-ac', '2', '-b:a', '128k',
        'out.mp3'
      ]);
      const out = (await ff.readFile('out.mp3')) as Uint8Array;
      const buf = new ArrayBuffer(out.byteLength);
      new Uint8Array(buf).set(out);
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const path = `${episodeId}/source.mp3`;
      setBusy('Uploading source…');
      const { error } = await supabase.storage.from(audioBucket).upload(path, blob, { upsert: true });
      if (error) throw error;
      setStatus('Audio extracted from video. Run transcription from the New Episode page if needed.');
      await refresh();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  // Render --------------------------------------------------------
  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const words = data?.transcript?.words ?? [];

  return (
    <div className="grid lg:grid-cols-[1fr,320px] gap-6">
      {/* LEFT: timeline + transcript */}
      <div className="space-y-6">
        {/* Source picker + transport */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="rounded border border-sage-200 bg-white px-2 py-1 text-sm"
              value={sourceKind}
              onChange={(e) => setSourceKind(e.target.value as SourceKind)}
            >
              <option value="source">Source (raw upload)</option>
              <option value="polished" disabled={!data?.urls.polished}>
                Polished (Auphonic)
              </option>
              <option value="final" disabled={!data?.urls.final}>
                Final render
              </option>
            </select>
            <button
              onClick={togglePlay}
              className="rounded bg-sage-700 px-3 py-1 text-sm text-white"
            >
              Play / Pause
            </button>
            <button
              onClick={addChapterAtPlayhead}
              className="rounded border border-sage-200 px-3 py-1 text-sm"
            >
              + Chapter @ {fmt(playhead)}
            </button>
            <button
              onClick={() => saveProject()}
              className="rounded border border-sage-200 px-3 py-1 text-sm"
            >
              Save
            </button>
            <span className="ml-auto text-xs text-sage-500">
              {fmt(playhead)} / {fmt(duration)} · {cuts.length} cuts · {chapters.length} chapters
            </span>
          </div>
          <div ref={waveContainer} className="mt-4" />
          {chapters.length > 0 && (
            <div className="relative mt-1 h-3">
              {chapters.map((ch, i) => (
                <div
                  key={i}
                  title={`${ch.title} @ ${fmt(ch.time)}`}
                  className="absolute h-3 w-[2px] bg-amber-600"
                  style={{ left: `${duration ? (ch.time / duration) * 100 : 0}%` }}
                />
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-sage-500">
            Drag on the waveform to mark a cut. Click a transcript word to scrub; shift-click a second
            word to cut the range between them.
          </p>
        </div>

        {/* Transcript */}
        <div className="card p-4">
          <h3 className="mb-3 font-display text-lg font-semibold">Transcript</h3>
          {words.length === 0 ? (
            <p className="text-sm text-sage-500">
              No word-level transcript yet. Run transcription from the New Episode flow — it will be
              re-transcribed with word timestamps.
            </p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto text-[15px] leading-relaxed">
              {words.map((w, i) => {
                const inCut = cuts.some((c) => w.start >= c.start && w.end <= c.end);
                const active = playhead >= w.start && playhead <= w.end;
                return (
                  <span
                    key={i}
                    onClick={(e) => onWordClick(w, e)}
                    className={[
                      'cursor-pointer rounded px-[1px]',
                      inCut ? 'text-sage-300 line-through' : '',
                      active ? 'bg-amber-100' : 'hover:bg-sage-50',
                      selectionAnchor === w.start ? 'ring-1 ring-amber-400' : ''
                    ].join(' ')}
                  >
                    {w.word}{' '}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: rail */}
      <aside className="space-y-4">
        {(busy || status || err) && (
          <div className="card p-3 text-sm">
            {busy && <p className="text-sage-700">⏳ {busy}</p>}
            {status && <p className="text-emerald-700">✓ {status}</p>}
            {err && <p className="text-red-700">✕ {err}</p>}
          </div>
        )}

        <div className="card p-4">
          <h4 className="font-display font-semibold">Chapters</h4>
          {chapters.length === 0 ? (
            <p className="mt-2 text-xs text-sage-500">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {chapters.map((ch, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <button onClick={() => seekTo(ch.time)} className="truncate text-left hover:underline">
                    {fmt(ch.time)} — {ch.title}
                  </button>
                  <button
                    onClick={() => removeChapter(i)}
                    className="text-xs text-sage-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-4">
          <h4 className="font-display font-semibold">Replace audio from phone video</h4>
          <p className="mt-1 text-xs text-sage-500">
            Drop in your phone's MP4/MOV. We strip the video and upload the cleaned audio as the new
            source. Runs in your browser.
          </p>
          <input
            type="file"
            accept="video/*"
            className="mt-2 block w-full text-xs"
            onChange={(e) => e.target.files?.[0] && replaceFromVideo(e.target.files[0])}
          />
        </div>

        <div className="card p-4">
          <h4 className="font-display font-semibold">Intro / Outro</h4>
          <label className="mt-2 block text-xs text-sage-600">
            Intro {data?.project.intro_path ? '✓' : ''}
            <input
              type="file"
              accept="audio/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => e.target.files?.[0] && uploadAux('intro', e.target.files[0])}
            />
          </label>
          <label className="mt-3 block text-xs text-sage-600">
            Outro {data?.project.outro_path ? '✓' : ''}
            <input
              type="file"
              accept="audio/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => e.target.files?.[0] && uploadAux('outro', e.target.files[0])}
            />
          </label>
        </div>

        <div className="card p-4">
          <h4 className="font-display font-semibold">Polish (Auphonic)</h4>
          <p className="mt-1 text-xs text-sage-500">
            Loudness leveling, denoise, hipass to broadcast spec (-16 LUFS).
          </p>
          <p className="mt-2 text-xs text-sage-600">
            Status: <span className="font-medium">{auphonicStatus ?? 'idle'}</span>
          </p>
          <button
            onClick={startPolish}
            disabled={!!busy || auphonicStatus === 'queued' || auphonicStatus === 'processing'}
            className="btn-primary mt-2 w-full text-sm disabled:opacity-50"
          >
            Send source to Auphonic
          </button>
        </div>

        <div className="card p-4">
          <h4 className="font-display font-semibold">Render</h4>
          <p className="mt-1 text-xs text-sage-500">
            Builds the final MP3 with cuts removed and intro/outro stitched, in your browser.
          </p>
          <button
            onClick={() => render(false)}
            disabled={!!busy}
            className="mt-2 w-full rounded border border-sage-300 px-3 py-2 text-sm disabled:opacity-50"
          >
            Render preview
          </button>
          <button
            onClick={() => render(true)}
            disabled={!!busy}
            className="btn-primary mt-2 w-full text-sm disabled:opacity-50"
          >
            Render & promote to published audio
          </button>
        </div>

        <p className="text-[11px] text-sage-400">
          Episode: {episodeTitle} · {episodeId.slice(0, 8)}
        </p>
      </aside>
    </div>
  );
}
