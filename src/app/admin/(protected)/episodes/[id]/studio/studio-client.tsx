'use client';

// Petspective Studio — single console for an entire episode.
//
// One page, five tabs, one save model:
//   • Source     — record in-browser, or upload audio/video (video → audio extract).
//   • Edit       — waveform, cuts, chapters, intro/outro, polish, render.
//   • Transcript — run/re-run Whisper, view word-level transcript.
//   • Notes      — generate show notes + entity links via Gemini.
//   • Cover      — generate 4-up covers, pick one.
//
// Metadata (title, season, breed, etc.) and Save / Publish / Delete live in the
// header so they're reachable from any tab. Drafts are saved on demand or on tab
// switch — never lost.
//
// Heavy deps (wavesurfer.js, ffmpeg.wasm) load only when their tab needs them.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import type {
  StudioCut,
  StudioChapter,
  TranscriptWord,
  AuphonicStatus
} from '@/lib/types';

type Episode = {
  id: string;
  slug: string;
  title: string;
  description: string;
  season: number | null;
  episode_number: number | null;
  status: string;
  audio_url: string | null;
  image_url: string | null;
  spotify_url: string | null;
  breed_species: 'dog' | 'cat' | null;
  breed_slug: string | null;
  published_at: string | null;
};

type Pipeline = {
  hasTranscript: boolean;
  transcriptLanguage: string | null;
  hasShowNotes: boolean;
  showNotesSummary: string | null;
  showNotesTakeaways: string[] | null;
  suggestedImagePrompt: string | null;
  entityLinkCount: number;
};

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
type Tab = 'source' | 'edit' | 'transcript' | 'notes' | 'cover';
type BreedOpt = { slug: string; name: string };

export default function StudioClient({
  audioBucket,
  initial,
  episode: episodeProp,
  pipeline: pipelineProp
}: {
  audioBucket: string;
  initial: Initial | null;
  episode: Episode;
  pipeline: Pipeline;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  // ─── Header / metadata state ─────────────────────────────────────
  const [episode, setEpisode] = useState<Episode>(episodeProp);
  const [pipeline, setPipeline] = useState<Pipeline>(pipelineProp);
  const [tab, setTab] = useState<Tab>(
    !initial?.urls.source ? 'source' : 'edit'
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const call = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(label);
    setErr(null);
    setStatus(null);
    try {
      const r = await fn();
      setStatus(`${label} ✓`);
      return r;
    } catch (e: any) {
      setErr(e?.message || String(e));
      return null;
    } finally {
      setBusy(null);
    }
  };

  // ─── Studio bundle (audio paths, transcript, cuts, chapters) ────
  const [data, setData] = useState<Initial | null>(initial);
  const [sourceKind, setSourceKind] = useState<SourceKind>(
    initial?.urls.polished ? 'polished' : 'source'
  );
  const [cuts, setCuts] = useState<StudioCut[]>(initial?.project.cuts ?? []);
  const [chapters, setChapters] = useState<StudioChapter[]>(initial?.project.chapters ?? []);
  const [duration, setDuration] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const [auphonicStatus, setAuphonicStatus] = useState<AuphonicStatus>(
    initial?.project.auphonic_status ?? null
  );

  const refreshStudio = useCallback(async () => {
    const res = await fetch(`/api/admin/episodes/${episode.id}/studio`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, [episode.id]);

  // ─── Cover art state ─────────────────────────────────────────────
  const [imagePrompt, setImagePrompt] = useState(pipeline.suggestedImagePrompt ?? '');
  const [imageOptions, setImageOptions] = useState<string[]>([]);

  // ─── Metadata draft state ────────────────────────────────────────
  const [title, setTitle] = useState(episode.title);
  const [description, setDescription] = useState(episode.description);
  const [season, setSeason] = useState<string>(
    episode.season === null ? '' : String(episode.season)
  );
  const [episodeNumber, setEpisodeNumber] = useState<string>(
    episode.episode_number === null ? '' : String(episode.episode_number)
  );
  const [spotifyUrl, setSpotifyUrl] = useState(episode.spotify_url ?? '');
  const [breedSpecies, setBreedSpecies] = useState<'' | 'dog' | 'cat'>(
    episode.breed_species ?? ''
  );
  const [breedSlug, setBreedSlug] = useState(episode.breed_slug ?? '');
  const [breedOptions, setBreedOptions] = useState<BreedOpt[]>([]);
  const dirty =
    title !== episode.title ||
    description !== (episode.description ?? '') ||
    season !== (episode.season === null ? '' : String(episode.season)) ||
    episodeNumber !==
      (episode.episode_number === null ? '' : String(episode.episode_number)) ||
    spotifyUrl !== (episode.spotify_url ?? '') ||
    breedSpecies !== (episode.breed_species ?? '') ||
    breedSlug !== (episode.breed_slug ?? '');

  useEffect(() => {
    if (!breedSpecies) {
      setBreedOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/breeds?species=${breedSpecies}`);
        const j = await res.json();
        if (!cancelled && Array.isArray(j.breeds)) setBreedOptions(j.breeds);
      } catch {
        if (!cancelled) setBreedOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [breedSpecies]);

  const saveMetadata = () =>
    call('Saving metadata', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          season: season === '' ? null : Number(season),
          episode_number: episodeNumber === '' ? null : Number(episodeNumber),
          spotify_url: spotifyUrl,
          breed_species: breedSpecies || null,
          breed_slug: breedSpecies ? breedSlug || null : null
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'save failed');
      setEpisode((e) => ({
        ...e,
        title,
        description,
        season: season === '' ? null : Number(season),
        episode_number: episodeNumber === '' ? null : Number(episodeNumber),
        spotify_url: spotifyUrl || null,
        breed_species: (breedSpecies || null) as 'dog' | 'cat' | null,
        breed_slug: breedSpecies ? breedSlug || null : null
      }));
      router.refresh();
    });

  const setEpisodeStatus = (next: 'draft' | 'published') =>
    call(next === 'published' ? 'Publishing' : 'Unpublishing', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      setEpisode((e) => ({ ...e, status: next }));
      router.refresh();
    });

  const deleteEpisode = async () => {
    if (
      !confirm(`Delete "${episode.title}"? This removes the row only — storage files stay.`)
    ) {
      return;
    }
    await call('Deleting', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      router.push('/admin');
      router.refresh();
    });
  };

  // ─── Source: in-browser recorder ─────────────────────────────────
  const [recMode, setRecMode] = useState<'audio' | 'video'>('audio');
  const [recording, setRecording] = useState(false);
  const [recElapsed, setRecElapsed] = useState(0);
  const [recPreviewUrl, setRecPreviewUrl] = useState<string | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recVideoRef = useRef<HTMLVideoElement | null>(null);
  const recTimerRef = useRef<number | null>(null);

  const stopStream = () => {
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    if (recVideoRef.current) recVideoRef.current.srcObject = null;
  };

  const startRecording = async () => {
    setErr(null);
    setStatus(null);
    setRecPreviewUrl(null);
    try {
      const constraints: MediaStreamConstraints =
        recMode === 'video' ? { audio: true, video: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      recStreamRef.current = stream;
      if (recMode === 'video' && recVideoRef.current) {
        recVideoRef.current.srcObject = stream;
        recVideoRef.current.muted = true;
        await recVideoRef.current.play().catch(() => {});
      }
      const mime =
        recMode === 'video'
          ? pickMime(['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'])
          : pickMime(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']);
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      recChunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && recChunksRef.current.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || (recMode === 'video' ? 'video/webm' : 'audio/webm');
        const blob = new Blob(recChunksRef.current, { type });
        setRecPreviewUrl(URL.createObjectURL(blob));
        (window as any).__petspective_lastRecording = { blob, mime: type };
        stopStream();
      };
      rec.start(1000);
      setRecording(true);
      const t0 = Date.now();
      setRecElapsed(0);
      recTimerRef.current = window.setInterval(
        () => setRecElapsed(Math.floor((Date.now() - t0) / 1000)),
        500
      );
    } catch (e: any) {
      setErr(e.message || 'Could not access microphone/camera');
    }
  };

  const stopRecording = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    recChunksRef.current = [];
    setRecording(false);
    setRecPreviewUrl(null);
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    stopStream();
  };

  const saveRecording = () =>
    call('Saving recording', async () => {
      const last = (window as any).__petspective_lastRecording as
        | { blob: Blob; mime: string }
        | undefined;
      if (!last) throw new Error('no recording in memory');
      const isVideo = last.mime.startsWith('video/');
      if (isVideo) {
        // Strip video → upload audio as the source.
        await uploadAudioFromVideoBlob(last.blob);
      } else {
        const ext = last.mime.includes('mp4') ? 'm4a' : 'webm';
        await uploadSourceBlob(last.blob, `recording.${ext}`, last.mime);
      }
      setRecPreviewUrl(null);
      (window as any).__petspective_lastRecording = undefined;
    });

  // ─── Source: file upload (audio or video) ────────────────────────
  const uploadSourceBlob = async (blob: Blob, filename: string, contentType?: string) => {
    const ext = filename.split('.').pop() || 'mp3';
    const path = `${episode.id}/source.${ext}`;
    const { error } = await supabase.storage
      .from(audioBucket)
      .upload(path, blob, { upsert: true, contentType });
    if (error) throw error;
    const res = await fetch(`/api/admin/episodes/${episode.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_storage_path: path })
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'patch failed');
    setEpisode((e) => ({ ...e, audio_url: j.audio_url ?? e.audio_url }));
    await refreshStudio();
    router.refresh();
  };

  const uploadAudioFile = (file: File) =>
    call('Uploading audio', async () => {
      await uploadSourceBlob(file, file.name, file.type || undefined);
    });

  /** Loads ffmpeg.wasm once and returns the instance (cached). */
  const ffRef = useRef<any>(null);
  const loadFFmpeg = async () => {
    if (ffRef.current) return ffRef.current;
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    const ff = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/[email protected]/dist/umd';
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
    ffRef.current = ff;
    return ff;
  };

  const uploadAudioFromVideoBlob = async (blob: Blob) => {
    setBusy('Loading ffmpeg…');
    const ff = await loadFFmpeg();
    const { fetchFile } = await import('@ffmpeg/util');
    setBusy('Extracting audio…');
    await ff.writeFile('in.mp4', await fetchFile(blob));
    await ff.exec([
      '-i', 'in.mp4',
      '-vn',
      '-ar', '44100', '-ac', '2', '-b:a', '128k',
      'out.mp3'
    ]);
    const out = (await ff.readFile('out.mp3')) as Uint8Array;
    const buf = new ArrayBuffer(out.byteLength);
    new Uint8Array(buf).set(out);
    const audioBlob = new Blob([buf], { type: 'audio/mpeg' });
    setBusy('Uploading source…');
    await uploadSourceBlob(audioBlob, 'source.mp3', 'audio/mpeg');
  };

  const uploadVideoFile = (file: File) =>
    call('Extracting & uploading audio', async () => {
      await uploadAudioFromVideoBlob(file);
    });

  // ─── AI pipeline: transcribe / show notes / entity links ────────
  const runTranscribe = () =>
    call('Transcribing', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/transcribe`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error((await res.json()).error || 'transcribe failed');
      setPipeline((p) => ({ ...p, hasTranscript: true }));
      await refreshStudio();
      router.refresh();
    });

  const runShowNotes = () =>
    call('Generating show notes', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/show-notes`, {
        method: 'POST'
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setPipeline((p) => ({
        ...p,
        hasShowNotes: true,
        showNotesSummary: j.summary ?? p.showNotesSummary,
        showNotesTakeaways: j.key_takeaways ?? p.showNotesTakeaways,
        suggestedImagePrompt: j.suggested_image_prompt ?? p.suggestedImagePrompt
      }));
      if (j.suggested_image_prompt) setImagePrompt(j.suggested_image_prompt);
      router.refresh();
    });

  const runEntities = () =>
    call('Linking subjects', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/link-entities`, {
        method: 'POST'
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setPipeline((p) => ({
        ...p,
        entityLinkCount: Array.isArray(j.entity_links)
          ? j.entity_links.length
          : p.entityLinkCount
      }));
      router.refresh();
    });

  // ─── Cover art ───────────────────────────────────────────────────
  const generateCovers = (mode: 'auto' | 'subject') =>
    call('Generating covers', async () => {
      const payload =
        mode === 'auto'
          ? { auto: true, count: 4 }
          : { subject: imagePrompt, count: 4, species: episode.breed_species };
      const res = await fetch(`/api/admin/episodes/${episode.id}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setImageOptions(j.urls ?? []);
    });

  const selectCover = (url: string) =>
    call('Saving cover', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/image/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setImageOptions([]);
      setEpisode((e) => ({ ...e, image_url: j.image_url ?? e.image_url }));
      router.refresh();
    });

  // ─── Edit tab: wavesurfer + cuts + chapters ──────────────────────
  const waveContainer = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<any>(null);
  const regionsRef = useRef<any>(null);
  const cutsRef = useRef<StudioCut[]>(cuts);
  useEffect(() => { cutsRef.current = cuts; }, [cuts]);

  const sourceUrl = useMemo(() => {
    if (sourceKind === 'polished') return data?.urls.polished ?? null;
    if (sourceKind === 'final') return data?.urls.final ?? null;
    return data?.urls.source ?? null;
  }, [sourceKind, data]);

  useEffect(() => {
    let cancelled = false;
    if (tab !== 'edit') return;
    if (!waveContainer.current || !sourceUrl) return;
    (async () => {
      const [{ default: WaveSurfer }, { default: RegionsPlugin }] = await Promise.all([
        import('wavesurfer.js'),
        import('wavesurfer.js/dist/plugins/regions.esm.js')
      ]);
      if (cancelled || !waveContainer.current) return;
      if (wsRef.current) { try { wsRef.current.destroy(); } catch {} wsRef.current = null; }
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
        setDuration(ws.getDuration());
        for (const c of cutsRef.current) {
          regions.addRegion({
            start: c.start, end: c.end,
            color: 'rgba(220,38,38,0.25)', drag: true, resize: true, content: 'cut'
          });
        }
      });
      ws.on('timeupdate', (t: number) => setPlayhead(t));
      regions.enableDragSelection({ color: 'rgba(220,38,38,0.25)' });
      regions.on('region-created', () => syncCutsFromRegions());
      regions.on('region-updated', () => syncCutsFromRegions());
      regions.on('region-removed', () => syncCutsFromRegions());
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sourceUrl]);

  const syncCutsFromRegions = useCallback(() => {
    const r = regionsRef.current;
    if (!r) return;
    const next: StudioCut[] = r
      .getRegions()
      .map((reg: any) => ({ start: reg.start, end: reg.end }))
      .sort((a: StudioCut, b: StudioCut) => a.start - b.start);
    setCuts(next);
  }, []);

  const togglePlay = () => wsRef.current?.playPause();
  const seekTo = (t: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    const d = ws.getDuration();
    if (d > 0) ws.seekTo(Math.min(Math.max(t / d, 0), 1));
  };
  const onWordClick = (w: TranscriptWord, e: React.MouseEvent) => {
    if (e.shiftKey && selectionAnchor !== null) {
      const start = Math.min(selectionAnchor, w.start);
      const end = Math.max(selectionAnchor, w.end);
      regionsRef.current?.addRegion({
        start, end, color: 'rgba(220,38,38,0.25)', drag: true, resize: true, content: 'cut'
      });
      setSelectionAnchor(null);
    } else {
      setSelectionAnchor(w.start);
      seekTo(w.start);
    }
  };
  const addChapterAtPlayhead = () => {
    const t = window.prompt('Chapter title?')?.trim();
    if (!t) return;
    setChapters((c) => [...c, { time: playhead, title: t }].sort((a, b) => a.time - b.time));
  };
  const removeChapter = (idx: number) =>
    setChapters((c) => c.filter((_, i) => i !== idx));

  const saveProject = (extra: Record<string, unknown> = {}) =>
    call('Saving edit', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/studio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuts, chapters, ...extra })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'save failed');
    });

  const uploadAux = (kind: 'intro' | 'outro', file: File) =>
    call(`Uploading ${kind}`, async () => {
      const path = `${episode.id}/${kind}.${file.name.split('.').pop() || 'mp3'}`;
      const { error } = await supabase.storage
        .from(audioBucket).upload(path, file, { upsert: true });
      if (error) throw error;
      await saveProject({ [`${kind}_path`]: path });
      await refreshStudio();
    });

  const startPolish = () =>
    call('Sending to Auphonic', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/studio/polish`, {
        method: 'POST'
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setAuphonicStatus('queued');
      pollPolish();
    });

  const pollPolish = useCallback(() => {
    const tick = async (): Promise<void> => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/studio/polish`, {
        cache: 'no-store'
      });
      const j = await res.json();
      if (j.status) setAuphonicStatus(j.status);
      if (j.status === 'done') {
        await refreshStudio();
        setStatus('Polish complete. Switch source to "Polished" to use it.');
        return;
      }
      if (j.status === 'error') { setErr('Auphonic returned error.'); return; }
      setTimeout(tick, 5000);
    };
    tick();
  }, [episode.id, refreshStudio]);

  useEffect(() => {
    if (auphonicStatus === 'queued' || auphonicStatus === 'processing') pollPolish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderFinal = (promote: boolean) =>
    call(promote ? 'Rendering & promoting' : 'Rendering preview', async () => {
      if (!sourceUrl) throw new Error('No source audio.');
      const ff = await loadFFmpeg();
      const { fetchFile } = await import('@ffmpeg/util');
      await ff.writeFile('source.mp3', await fetchFile(sourceUrl));
      const introUrl = data?.urls.intro;
      const outroUrl = data?.urls.outro;
      if (introUrl) await ff.writeFile('intro.mp3', await fetchFile(introUrl));
      if (outroUrl) await ff.writeFile('outro.mp3', await fetchFile(outroUrl));

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
        await ff.exec([
          ...inputs,
          '-filter_complex', `${filterParts.join('')}concat=n=${n}:v=0:a=1[out]`,
          '-map', '[out]',
          '-ar', '44100', '-ac', '2', '-b:a', '128k',
          'final.mp3'
        ]);
        finalName = 'final.mp3';
      }
      const out = (await ff.readFile(finalName)) as Uint8Array;
      const buf = new ArrayBuffer(out.byteLength);
      new Uint8Array(buf).set(out);
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const path = `${episode.id}/final.mp3`;
      const { error } = await supabase.storage
        .from(audioBucket).upload(path, blob, { upsert: true });
      if (error) throw error;
      const res = await fetch(`/api/admin/episodes/${episode.id}/studio/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_audio_path: path, promote })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await refreshStudio();
      router.refresh();
    });

  // ─── Render ──────────────────────────────────────────────────────
  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };
  const words = data?.transcript?.words ?? [];
  const hasSource = Boolean(data?.urls.source);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-wide text-sage-500">
            Studio · {episode.season ? `S${episode.season} · ` : ''}
            {episode.episode_number !== null ? `Ep ${episode.episode_number}` : 'Draft'}
          </p>
          <h1 className="font-display text-3xl font-bold truncate">{episode.title}</h1>
          <p className="mt-1 text-xs text-sage-500">
            <StatusPill status={episode.status} />
            <span className="ml-2">slug: <span className="font-mono">{episode.slug}</span></span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveMetadata}
            disabled={!dirty || !!busy}
            className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50 disabled:opacity-50"
          >
            {dirty ? 'Save draft' : 'Saved'}
          </button>
          {episode.status === 'published' ? (
            <button
              onClick={() => setEpisodeStatus('draft')}
              disabled={!!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50 disabled:opacity-50"
            >
              Move to draft
            </button>
          ) : (
            <button
              onClick={() => setEpisodeStatus('published')}
              disabled={!!busy}
              className="btn-primary text-sm"
            >
              🚀 Publish
            </button>
          )}
          {episode.status === 'published' && (
            <Link
              href={`/episode/${episode.slug}`}
              target="_blank"
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50"
            >
              View live ↗
            </Link>
          )}
          <button
            onClick={deleteEpisode}
            disabled={!!busy}
            className="rounded-lg border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* STATUS BAR */}
      {(busy || status || err) && (
        <div className="card p-3 text-sm">
          {busy && <p className="text-sage-700">⏳ {busy}…</p>}
          {status && !busy && <p className="text-emerald-700">{status}</p>}
          {err && <p className="text-red-700">✕ {err}</p>}
        </div>
      )}

      {/* PROGRESS / TABS */}
      <div className="flex flex-wrap gap-2 border-b border-sage-100 pb-2">
        <TabButton active={tab === 'source'} onClick={() => setTab('source')} done={hasSource}>
          1 · Source
        </TabButton>
        <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} done={hasSource}>
          2 · Edit
        </TabButton>
        <TabButton
          active={tab === 'transcript'}
          onClick={() => setTab('transcript')}
          done={pipeline.hasTranscript}
        >
          3 · Transcript
        </TabButton>
        <TabButton
          active={tab === 'notes'}
          onClick={() => setTab('notes')}
          done={pipeline.hasShowNotes}
        >
          4 · Notes
        </TabButton>
        <TabButton
          active={tab === 'cover'}
          onClick={() => setTab('cover')}
          done={Boolean(episode.image_url)}
        >
          5 · Cover
        </TabButton>
      </div>

      {/* METADATA — always visible, collapsible */}
      <details className="card p-5" open={tab === 'source'}>
        <summary className="cursor-pointer font-display font-semibold">
          Episode metadata {dirty && <span className="ml-2 text-xs text-amber-700">unsaved</span>}
        </summary>
        <div className="mt-4 grid gap-3 max-w-2xl">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Season">
              <input
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                type="number"
                min={1}
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
              />
            </Field>
            <Field label="Episode #">
              <input
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                type="number"
                min={0}
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Featured species">
              <select
                value={breedSpecies}
                onChange={(e) => {
                  setBreedSpecies(e.target.value as '' | 'dog' | 'cat');
                  setBreedSlug('');
                }}
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
              >
                <option value="">— none —</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
              </select>
            </Field>
            <Field label="Featured breed">
              <select
                value={breedSlug}
                onChange={(e) => setBreedSlug(e.target.value)}
                disabled={!breedSpecies || breedOptions.length === 0}
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400 disabled:opacity-50"
              >
                <option value="">— none —</option>
                {breedOptions.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Spotify URL (optional)">
            <input
              value={spotifyUrl}
              onChange={(e) => setSpotifyUrl(e.target.value)}
              placeholder="https://open.spotify.com/episode/…"
              className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
            />
          </Field>
        </div>
      </details>

      {/* TAB BODIES */}
      {tab === 'source' && (
        <SourceTab
          recMode={recMode}
          setRecMode={setRecMode}
          recording={recording}
          recElapsed={recElapsed}
          recPreviewUrl={recPreviewUrl}
          recVideoRef={recVideoRef}
          startRecording={startRecording}
          stopRecording={stopRecording}
          cancelRecording={cancelRecording}
          saveRecording={saveRecording}
          uploadAudioFile={uploadAudioFile}
          uploadVideoFile={uploadVideoFile}
          hasSource={hasSource}
          sourceUrl={data?.urls.source ?? null}
          fmt={fmt}
        />
      )}

      {tab === 'edit' && (
        <div className="grid lg:grid-cols-[1fr,320px] gap-6">
          <div className="space-y-6">
            <div className="card p-4">
              {!sourceUrl ? (
                <p className="text-sm text-sage-600">
                  Upload or record audio in the Source tab first.
                </p>
              ) : (
                <>
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
                    <button onClick={togglePlay} className="rounded bg-sage-700 px-3 py-1 text-sm text-white">
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
                      Save edit
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
                    Drag on the waveform to mark a cut. Click a transcript word (Transcript tab) to scrub;
                    shift-click a second word to cut the range between them.
                  </p>
                </>
              )}
            </div>
          </div>

          <aside className="space-y-4">
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
                disabled={!!busy || !sourceUrl || auphonicStatus === 'queued' || auphonicStatus === 'processing'}
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
                onClick={() => renderFinal(false)}
                disabled={!!busy || !sourceUrl}
                className="mt-2 w-full rounded border border-sage-300 px-3 py-2 text-sm disabled:opacity-50"
              >
                Render preview
              </button>
              <button
                onClick={() => renderFinal(true)}
                disabled={!!busy || !sourceUrl}
                className="btn-primary mt-2 w-full text-sm disabled:opacity-50"
              >
                Render & promote to published audio
              </button>
            </div>
          </aside>
        </div>
      )}

      {tab === 'transcript' && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">Transcript</h3>
            <span className="ml-auto rounded-full bg-sage-100 px-2 py-0.5 text-xs">
              {pipeline.hasTranscript
                ? `✓ ${pipeline.transcriptLanguage ?? 'transcribed'}`
                : 'not yet'}
            </span>
            <button
              onClick={runTranscribe}
              disabled={!hasSource || !!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50 disabled:opacity-50"
            >
              {pipeline.hasTranscript ? 'Re-transcribe' : '🎙️ Generate transcript (Whisper)'}
            </button>
          </div>
          {!hasSource && (
            <p className="mt-3 text-sm text-sage-500">
              Upload or record audio in the Source tab first.
            </p>
          )}
          {words.length > 0 ? (
            <div className="mt-4 max-h-[480px] overflow-y-auto text-[15px] leading-relaxed">
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
          ) : data?.transcript?.raw_text ? (
            <p className="mt-4 whitespace-pre-line text-sm text-sage-800">
              {data.transcript.raw_text}
            </p>
          ) : (
            hasSource && (
              <p className="mt-3 text-sm text-sage-500">No transcript yet — click the button above.</p>
            )
          )}
        </div>
      )}

      {tab === 'notes' && (
        <div className="card p-5 grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">Show notes & subject links</h3>
            <span className="ml-auto rounded-full bg-sage-100 px-2 py-0.5 text-xs">
              entity links: {pipeline.entityLinkCount}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runShowNotes}
              disabled={!pipeline.hasTranscript || !!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-sage-50"
            >
              {pipeline.hasShowNotes ? 'Re-generate show notes' : '📝 Generate show notes (Gemini)'}
            </button>
            <button
              onClick={runEntities}
              disabled={!pipeline.hasTranscript || !!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-sage-50"
            >
              {pipeline.entityLinkCount > 0 ? 'Re-link subjects' : '🔗 Link subjects'}
            </button>
          </div>
          {!pipeline.hasTranscript && (
            <p className="text-sm text-sage-500">Generate the transcript first.</p>
          )}
          {pipeline.showNotesSummary && (
            <div className="rounded-lg bg-sage-50 p-3 text-sm">
              <p className="font-semibold">Summary</p>
              <p className="mt-1 whitespace-pre-line">{pipeline.showNotesSummary}</p>
              {pipeline.showNotesTakeaways && pipeline.showNotesTakeaways.length > 0 && (
                <>
                  <p className="mt-3 font-semibold">Key takeaways</p>
                  <ul className="mt-1 list-inside list-disc">
                    {pipeline.showNotesTakeaways.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'cover' && (
        <div className="card p-5 grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-lg font-semibold">Cover art</h3>
            {episode.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={episode.image_url}
                alt={episode.title}
                className="aspect-square w-32 rounded-xl object-cover ring-1 ring-sage-200"
              />
            )}
          </div>
          <p className="text-xs text-sage-500 max-w-2xl">
            Covers always render in the Petspective house style — sage / cream / ink palette,
            no faces, no text, calm negative-space top-left.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => generateCovers('auto')}
              disabled={!!busy}
              className="btn-primary text-sm"
            >
              ✨ Generate cover from episode
            </button>
            <span className="text-[11px] text-sage-500 self-center">
              uses title + show notes summary
            </span>
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-sage-700">
              Or describe a custom subject
            </summary>
            <div className="mt-3 grid gap-3 max-w-2xl">
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                rows={3}
                placeholder='Subject only — e.g. "a calm tabby cat on a vet exam table"'
                className="rounded-xl border border-sage-200 bg-white px-4 py-3 text-ink placeholder:text-sage-400"
              />
              <button
                onClick={() => generateCovers('subject')}
                disabled={!imagePrompt.trim() || !!busy}
                className="rounded-lg border border-sage-300 px-3 py-2 text-sm self-start disabled:opacity-50 hover:bg-sage-50"
              >
                Generate from custom subject
              </button>
            </div>
          </details>
          {imageOptions.length > 0 && (
            <div className="grid gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sage-600">
                Pick one — clicking saves it as the episode cover
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-2xl sm:grid-cols-4">
                {imageOptions.map((u) => (
                  <button
                    key={u}
                    onClick={() => selectCover(u)}
                    disabled={!!busy}
                    className="group relative rounded-xl overflow-hidden border-2 border-sage-200 hover:border-sage-600 disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="option" className="aspect-square w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 bg-ink/70 px-2 py-1 text-center text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100">
                      Use this cover
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────

function pickMime(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const m of candidates) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {}
  }
  return undefined;
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'published'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'draft'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-sage-100 text-sage-700';
  return (
    <span className={`rounded-full px-2 py-0.5 uppercase font-semibold ${cls}`}>{status}</span>
  );
}

function TabButton({
  active, onClick, done, children
}: {
  active: boolean;
  onClick: () => void;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-2 text-sm font-medium transition',
        active
          ? 'bg-sage-700 text-white'
          : done
          ? 'bg-sage-100 text-sage-800 hover:bg-sage-200'
          : 'bg-white text-sage-600 hover:bg-sage-50 border border-sage-100'
      ].join(' ')}
    >
      {done && !active && <span className="mr-1">✓</span>}
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-sage-600">{label}</span>
      {children}
    </label>
  );
}

function SourceTab({
  recMode, setRecMode,
  recording, recElapsed, recPreviewUrl, recVideoRef,
  startRecording, stopRecording, cancelRecording, saveRecording,
  uploadAudioFile, uploadVideoFile,
  hasSource, sourceUrl, fmt
}: {
  recMode: 'audio' | 'video';
  setRecMode: (m: 'audio' | 'video') => void;
  recording: boolean;
  recElapsed: number;
  recPreviewUrl: string | null;
  recVideoRef: React.RefObject<HTMLVideoElement>;
  startRecording: () => void;
  stopRecording: () => void;
  cancelRecording: () => void;
  saveRecording: () => void;
  uploadAudioFile: (f: File) => void;
  uploadVideoFile: (f: File) => void;
  hasSource: boolean;
  sourceUrl: string | null;
  fmt: (t: number) => string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Record */}
      <div className="card p-5">
        <h3 className="font-display text-lg font-semibold">Record in browser</h3>
        <p className="mt-1 text-xs text-sage-500">
          Plug your mic (and camera, if you want video) into this laptop or phone, then record straight
          into the Studio. We save audio as the episode source — if you record video, we'll strip the
          audio out automatically.
        </p>

        <div className="mt-4 flex gap-2 text-sm">
          <button
            disabled={recording}
            onClick={() => setRecMode('audio')}
            className={`rounded px-3 py-1 border ${
              recMode === 'audio' ? 'bg-sage-700 text-white border-sage-700' : 'border-sage-200'
            }`}
          >
            🎙️ Audio only
          </button>
          <button
            disabled={recording}
            onClick={() => setRecMode('video')}
            className={`rounded px-3 py-1 border ${
              recMode === 'video' ? 'bg-sage-700 text-white border-sage-700' : 'border-sage-200'
            }`}
          >
            🎥 Audio + Video
          </button>
        </div>

        {recMode === 'video' && (
          <video
            ref={recVideoRef}
            playsInline
            className="mt-3 aspect-video w-full rounded-lg bg-ink/90 object-cover"
          />
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!recording && !recPreviewUrl && (
            <button onClick={startRecording} className="btn-primary text-sm">
              ● Start recording
            </button>
          )}
          {recording && (
            <>
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 animate-pulse">
                ● REC {fmt(recElapsed)}
              </span>
              <button onClick={stopRecording} className="btn-primary text-sm">
                Stop
              </button>
              <button
                onClick={cancelRecording}
                className="rounded-lg border border-sage-200 px-3 py-1 text-sm"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {recPreviewUrl && !recording && (
          <div className="mt-4 grid gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-600">Preview</p>
            {recMode === 'video' ? (
              <video src={recPreviewUrl} controls className="aspect-video w-full rounded-lg" />
            ) : (
              <audio src={recPreviewUrl} controls className="w-full" />
            )}
            <div className="flex gap-2">
              <button onClick={saveRecording} className="btn-primary text-sm">
                Save as episode source
              </button>
              <button
                onClick={cancelRecording}
                className="rounded-lg border border-sage-200 px-3 py-1 text-sm"
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="card p-5">
        <h3 className="font-display text-lg font-semibold">Upload a file</h3>
        <p className="mt-1 text-xs text-sage-500">
          Already have a recording? Drop in an MP3 / WAV / M4A — or a phone video and we'll extract the
          audio in your browser.
        </p>
        <label className="mt-4 block border-2 border-dashed border-sage-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-sage-50">
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/webm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAudioFile(e.target.files[0])}
          />
          <p className="text-sm text-sage-700 font-medium">🎵 Upload audio</p>
          <p className="mt-1 text-xs text-sage-500">MP3, WAV, M4A, WebM</p>
        </label>
        <label className="mt-3 block border-2 border-dashed border-sage-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-sage-50">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadVideoFile(e.target.files[0])}
          />
          <p className="text-sm text-sage-700 font-medium">🎥 Upload video (we'll extract audio)</p>
          <p className="mt-1 text-xs text-sage-500">MP4, MOV, WebM — runs in your browser</p>
        </label>

        {hasSource && sourceUrl && (
          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-sage-600">
              Current source ✓
            </p>
            <audio src={sourceUrl} controls className="mt-2 w-full" />
            <p className="mt-1 text-xs text-sage-500">
              Uploading or recording again will replace it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
