'use client';
import { useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

type Step = 1 | 2 | 3 | 4;

export default function NewEpisodePage() {
  const router = useRouter();
  const supabase = createSupabaseBrowser();

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [season, setSeason] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  // Step 2
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Step 3
  const [transcriptPreview, setTranscriptPreview] = useState<string>('');
  const [showNotes, setShowNotes] = useState<any>(null);
  const [entityLinks, setEntityLinks] = useState<
    { term: string; type: string; url: string; description?: string }[]
  >([]);

  // Step 4
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // ---------- Step 1: create draft ----------
  const createDraft = async () => {
    setBusy('Creating draft…');
    setErr(null);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await fetch('/api/admin/episodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          description,
          season: season ? parseInt(season) : null,
          episode_number: episodeNumber ? parseInt(episodeNumber) : null
        })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setEpisodeId(j.id);
      setStep(2);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  // ---------- Step 2: upload audio ----------
  const uploadAudio = async () => {
    if (!audioFile || !episodeId) return;
    setBusy('Uploading audio…');
    setErr(null);
    try {
      const path = `${episodeId}/${audioFile.name}`;
      const { error } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET_AUDIO || 'pet-podcast-audio')
        .upload(path, audioFile, { upsert: true });
      if (error) throw error;

      const upd = await fetch(`/api/admin/episodes/${episodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_storage_path: path })
      });
      const j = await upd.json();
      if (!upd.ok) throw new Error(j.error);
      setAudioUrl(j.audio_url);
      setStep(3);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(null);
    }
  };

  // ---------- Step 3: AI pipeline ----------
  const runTranscribe = async () => {
    setBusy('Transcribing with Whisper…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/transcribe`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setTranscriptPreview(j.text.slice(0, 800));
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  const runShowNotes = async () => {
    setBusy('Generating show notes with Gemini…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/show-notes`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setShowNotes(j);
      setImagePrompt(j.suggested_image_prompt || '');
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  const runLinkEntities = async () => {
    setBusy('Linking key subjects to outside sources…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/link-entities`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setEntityLinks(j.entity_links ?? []);
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  // ---------- Step 4: image studio ----------
  const generateImages = async () => {
    setBusy('Generating image options…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: imagePrompt, count: 4 })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setImageOptions(j.urls);
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  const selectImage = async (url: string) => {
    setBusy('Saving image…');
    setErr(null);
    try {
      const res = await fetch(`/api/admin/episodes/${episodeId}/image/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setSelectedImage(j.image_url);
    } catch (e: any) { setErr(e.message); } finally { setBusy(null); }
  };

  const publish = async () => {
    setBusy('Publishing…');
    const res = await fetch(`/api/admin/episodes/${episodeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' })
    });
    setBusy(null);
    if (res.ok) router.push('/admin/episodes');
  };

  return (
    <div className="grid lg:grid-cols-[200px,1fr] gap-8">
      {/* Stepper */}
      <aside className="space-y-2">
        {(['Basic info', 'Upload audio', 'AI processing', 'Image studio'] as const).map(
          (label, i) => {
            const n = (i + 1) as Step;
            const active = step === n;
            const done = step > n;
            return (
              <div
                key={label}
                className={`px-4 py-3 rounded-xl border text-sm ${
                  active
                    ? 'bg-sage-600 text-white border-sage-600'
                    : done
                    ? 'bg-sage-50 border-sage-200'
                    : 'bg-white border-sage-100 text-sage-500'
                }`}
              >
                <span className="font-mono text-xs mr-2">{n}.</span> {label}
              </div>
            );
          }
        )}
      </aside>

      <section className="card p-8 min-h-[500px]">
        {err && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{err}</div>
        )}
        {busy && (
          <div className="mb-4 rounded-lg bg-sage-50 text-sage-800 px-3 py-2 text-sm">⏳ {busy}</div>
        )}

        {step === 1 && (
          <div className="grid gap-4 max-w-xl">
            <h2 className="text-xl font-bold">Step 1 · Basic Info</h2>
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
            <button onClick={createDraft} disabled={!title || !!busy} className="btn-primary">
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 max-w-xl">
            <h2 className="text-xl font-bold">Step 2 · Upload Audio</h2>
            <label className="block border-2 border-dashed border-sage-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-sage-50">
              <input
                type="file"
                accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <p className="text-sage-600">
                {audioFile ? audioFile.name : 'Drag & drop or click to select MP3 / WAV / M4A'}
              </p>
            </label>
            <button onClick={uploadAudio} disabled={!audioFile || !!busy} className="btn-primary">
              Upload & Continue →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Step 3 · AI Processing</h2>
            {audioUrl && (
              <audio src={audioUrl} controls className="w-full" />
            )}
            <div className="flex flex-wrap gap-3">
              <button onClick={runTranscribe} disabled={!!busy} className="btn-primary">
                🎙️ Generate Transcript (Whisper)
              </button>
              <button
                onClick={runShowNotes}
                disabled={!!busy || !transcriptPreview}
                className="btn-primary"
              >
                📝 Generate Show Notes (Gemini)
              </button>
              <button
                onClick={runLinkEntities}
                disabled={!!busy || !transcriptPreview}
                className="btn-primary"
              >
                🔗 Link Key Subjects (Gemini)
              </button>
            </div>
            {transcriptPreview && (
              <div>
                <h3 className="font-semibold text-sm uppercase text-sage-600 mt-3">Transcript preview</h3>
                <p className="mt-2 text-sm text-sage-800 whitespace-pre-line">
                  {transcriptPreview}…
                </p>
              </div>
            )}
            {entityLinks.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold text-sm uppercase text-sage-600">
                  Auto-linked subjects ({entityLinks.length})
                </h3>
                <ul className="mt-2 grid sm:grid-cols-2 gap-2 text-sm">
                  {entityLinks.map((e) => (
                    <li key={e.term} className="rounded-lg border border-sage-100 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{e.term}</span>
                        <span className="text-xs uppercase text-sage-500">{e.type}</span>
                      </div>
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sage-700 underline break-all"
                      >
                        {e.url}
                      </a>
                      {e.description && (
                        <p className="mt-1 text-xs text-sage-600">{e.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {showNotes && (
              <div className="mt-4 grid gap-2">
                <h3 className="font-semibold">Summary</h3>
                <p className="text-sm">{showNotes.summary}</p>
                <h3 className="font-semibold mt-2">Key Takeaways</h3>
                <ul className="list-disc list-inside text-sm">
                  {showNotes.key_takeaways?.map((k: string, i: number) => <li key={i}>{k}</li>)}
                </ul>
                <button onClick={() => setStep(4)} className="btn-primary mt-4 self-start">
                  Continue to Image Studio →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-4">
            <h2 className="text-xl font-bold">Step 4 · Image Studio</h2>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
              className="rounded-xl border border-sage-200 px-4 py-3"
              placeholder="Visual prompt for the episode art"
            />
            <button onClick={generateImages} disabled={!imagePrompt || !!busy} className="btn-primary self-start">
              ✨ Generate 4 Options
            </button>
            {imageOptions.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {imageOptions.map((u) => (
                  <button
                    key={u}
                    onClick={() => selectImage(u)}
                    className={`rounded-2xl overflow-hidden border-4 ${
                      selectedImage === u ? 'border-sage-600' : 'border-transparent'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="option" className="w-full aspect-square object-cover" />
                  </button>
                ))}
              </div>
            )}
            {selectedImage && (
              <button onClick={publish} className="btn-primary self-start">
                🚀 Publish Episode
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
