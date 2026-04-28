'use client';

// Episode hub client — basic info editor + audio re-upload + AI pipeline
// triggers + publish/unpublish + delete. Lets you resume any draft from
// /admin/episodes/[id]. The Studio link in the parent header handles
// recording/editing audio; this page handles everything else.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

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

export default function EpisodeHubClient({
  episode,
  pipeline,
  audioBucket
}: {
  episode: Episode;
  pipeline: Pipeline;
  audioBucket: string;
}) {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [title, setTitle] = useState(episode.title);
  const [description, setDescription] = useState(episode.description);
  const [season, setSeason] = useState<string>(
    episode.season === null ? '' : String(episode.season)
  );
  const [episodeNumber, setEpisodeNumber] = useState<string>(
    episode.episode_number === null ? '' : String(episode.episode_number)
  );
  const [spotifyUrl, setSpotifyUrl] = useState(episode.spotify_url ?? '');
  const [imagePrompt, setImagePrompt] = useState(pipeline.suggestedImagePrompt ?? '');
  const [imageOptions, setImageOptions] = useState<string[]>([]);

  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const call = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(label);
    setErr(null);
    setStatus(null);
    try {
      const r = await fn();
      setStatus(`${label} done.`);
      return r;
    } catch (e: any) {
      setErr(e?.message || String(e));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveBasics = () =>
    call('Saving basics', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          season: season === '' ? null : Number(season),
          episode_number: episodeNumber === '' ? null : Number(episodeNumber),
          spotify_url: spotifyUrl
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'save failed');
      router.refresh();
    });

  const uploadAudio = (file: File) =>
    call('Uploading audio', async () => {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `${episode.id}/source.${ext}`;
      const { error } = await supabase.storage
        .from(audioBucket)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const res = await fetch(`/api/admin/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_storage_path: path })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'patch failed');
      router.refresh();
    });

  const runTranscribe = () =>
    call('Transcribing', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/transcribe`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error((await res.json()).error || 'transcribe failed');
      router.refresh();
    });

  const runShowNotes = () =>
    call('Generating show notes', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/show-notes`, {
        method: 'POST'
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      if (j.suggested_image_prompt) setImagePrompt(j.suggested_image_prompt);
      router.refresh();
    });

  const runEntities = () =>
    call('Linking subjects', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/link-entities`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      router.refresh();
    });

  const generateImages = (mode: 'auto' | 'subject') =>
    call('Generating images', async () => {
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

  const selectImage = (url: string) =>
    call('Saving cover', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}/image/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      setImageOptions([]);
      router.refresh();
    });

  const setStatusTo = (next: 'draft' | 'published') =>
    call(next === 'published' ? 'Publishing' : 'Unpublishing', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      router.refresh();
    });

  const deleteEpisode = async () => {
    if (!confirm(`Delete "${episode.title}"? This removes the row only — storage files stay.`)) {
      return;
    }
    await call('Deleting', async () => {
      const res = await fetch(`/api/admin/episodes/${episode.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'failed');
      router.push('/admin/episodes');
      router.refresh();
    });
  };

  const Step = ({
    n,
    label,
    done,
    children
  }: {
    n: number;
    label: string;
    done: boolean;
    children: React.ReactNode;
  }) => (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <span
          className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
            done ? 'bg-sage-600 text-white' : 'bg-sage-100 text-sage-600'
          }`}
        >
          {done ? '✓' : n}
        </span>
        <h3 className="font-display font-semibold">{label}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );

  return (
    <div className="grid gap-4">
      {(busy || status || err) && (
        <div className="card p-3 text-sm">
          {busy && <p className="text-sage-700">⏳ {busy}…</p>}
          {status && !busy && <p className="text-emerald-700">✓ {status}</p>}
          {err && <p className="text-red-700">✕ {err}</p>}
        </div>
      )}

      <Step n={1} label="Basic info" done={Boolean(episode.title)}>
        <div className="grid gap-3 max-w-2xl">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Episode title"
            className="rounded-xl border border-sage-200 px-4 py-3"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            rows={4}
            className="rounded-xl border border-sage-200 px-4 py-3"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="Season"
              type="number"
              className="rounded-xl border border-sage-200 px-4 py-3"
            />
            <input
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(e.target.value)}
              placeholder="Episode #"
              type="number"
              className="rounded-xl border border-sage-200 px-4 py-3"
            />
          </div>
          <input
            value={spotifyUrl}
            onChange={(e) => setSpotifyUrl(e.target.value)}
            placeholder="Spotify URL (optional)"
            className="rounded-xl border border-sage-200 px-4 py-3"
          />
          <button onClick={saveBasics} disabled={!!busy} className="btn-primary self-start">
            Save basics
          </button>
        </div>
      </Step>

      <Step n={2} label="Audio" done={Boolean(episode.audio_url)}>
        {episode.audio_url ? (
          <div className="grid gap-3">
            <audio src={episode.audio_url} controls className="w-full" />
            <p className="text-xs text-sage-500">
              For trimming, chapters, polish, and final render use the Studio (top right).
            </p>
            <label className="text-sm">
              Replace source audio
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                className="mt-1 block text-xs"
                onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])}
              />
            </label>
          </div>
        ) : (
          <label className="block border-2 border-dashed border-sage-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-sage-50">
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])}
            />
            <p className="text-sage-600">Click to upload MP3 / WAV / M4A</p>
          </label>
        )}
      </Step>

      <Step n={3} label="AI pipeline" done={pipeline.hasTranscript && pipeline.hasShowNotes}>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 ${
                pipeline.hasTranscript ? 'bg-emerald-100 text-emerald-800' : 'bg-sage-100 text-sage-600'
              }`}
            >
              Transcript {pipeline.hasTranscript ? '✓' : '—'}
              {pipeline.transcriptLanguage ? ` (${pipeline.transcriptLanguage})` : ''}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                pipeline.hasShowNotes ? 'bg-emerald-100 text-emerald-800' : 'bg-sage-100 text-sage-600'
              }`}
            >
              Show notes {pipeline.hasShowNotes ? '✓' : '—'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                pipeline.entityLinkCount > 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-sage-100 text-sage-600'
              }`}
            >
              Entity links: {pipeline.entityLinkCount}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={runTranscribe}
              disabled={!episode.audio_url || !!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-sage-50"
            >
              {pipeline.hasTranscript ? 'Re-transcribe' : 'Transcribe (Whisper)'}
            </button>
            <button
              onClick={runShowNotes}
              disabled={!pipeline.hasTranscript || !!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-sage-50"
            >
              {pipeline.hasShowNotes ? 'Re-generate show notes' : 'Generate show notes (Gemini)'}
            </button>
            <button
              onClick={runEntities}
              disabled={!pipeline.hasTranscript || !!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-sage-50"
            >
              {pipeline.entityLinkCount > 0 ? 'Re-link subjects' : 'Link subjects (Gemini)'}
            </button>
          </div>
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
      </Step>

      <Step n={4} label="Cover art" done={Boolean(episode.image_url)}>
        <div className="grid gap-3">
          {episode.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={episode.image_url}
              alt={episode.title}
              className="aspect-square w-48 rounded-xl object-cover ring-1 ring-sage-200"
            />
          )}
          <p className="text-xs text-sage-500 max-w-2xl">
            All covers are rendered with the Petspective house style (sage / cream / ink palette,
            no faces, no text, calm negative-space top-left). You don&apos;t need to specify the
            style — just the subject.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => generateImages('auto')}
              disabled={!!busy}
              className="btn-primary text-sm"
            >
              ✨ Generate cover from episode
            </button>
            <span className="text-[11px] text-sage-500 self-center">
              uses title + show notes summary
            </span>
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-sage-700">
              Or describe a custom subject
            </summary>
            <div className="mt-3 grid gap-3">
              <textarea
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                rows={3}
                placeholder='Subject only — e.g. "a calm tabby cat resting on a vet exam table, vet stethoscope in soft focus"'
                className="rounded-xl border border-sage-200 px-4 py-3 max-w-2xl"
              />
              <button
                onClick={() => generateImages('subject')}
                disabled={!imagePrompt.trim() || !!busy}
                className="rounded-lg border border-sage-300 px-3 py-2 text-sm self-start disabled:opacity-50 hover:bg-sage-50"
              >
                Generate from custom subject
              </button>
            </div>
          </details>
          {imageOptions.length > 0 && (
            <div className="grid grid-cols-2 gap-3 max-w-2xl sm:grid-cols-4">
              {imageOptions.map((u) => (
                <button
                  key={u}
                  onClick={() => selectImage(u)}
                  className="rounded-xl overflow-hidden border-2 border-transparent hover:border-sage-600"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="option" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </Step>

      <Step n={5} label="Publish" done={episode.status === 'published'}>
        <div className="flex flex-wrap gap-2">
          {episode.status === 'published' ? (
            <button
              onClick={() => setStatusTo('draft')}
              disabled={!!busy}
              className="rounded-lg border border-sage-300 px-3 py-2 text-sm hover:bg-sage-50 disabled:opacity-50"
            >
              Move back to draft
            </button>
          ) : (
            <button
              onClick={() => setStatusTo('published')}
              disabled={!!busy}
              className="btn-primary text-sm"
            >
              🚀 Publish
            </button>
          )}
          <button
            onClick={deleteEpisode}
            disabled={!!busy}
            className="ml-auto rounded-lg border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
          >
            Delete episode
          </button>
        </div>
      </Step>
    </div>
  );
}
