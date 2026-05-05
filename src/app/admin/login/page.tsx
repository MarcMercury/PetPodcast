'use client';
import { Suspense, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const denied = params.get('denied');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    else router.push('/admin');
  };

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">Admin Sign-in</h1>
        <p className="text-sage-300 text-sm mt-1">
          Restricted to Pet Podcast creators.
        </p>
        {denied && (
          <p className="mt-4 rounded-lg bg-red-500/10 text-red-300 px-3 py-2 text-sm">
            Your account does not have admin/vet access.
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="rounded-xl border border-bone bg-ink-soft text-cream placeholder:text-sage-400 px-4 py-3"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="rounded-xl border border-bone bg-ink-soft text-cream placeholder:text-sage-400 px-4 py-3"
          />
          {err && <p className="text-sm text-red-300">{err}</p>}
          <button disabled={loading} className="btn-primary justify-center">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-xs text-sage-400">
          Tip: enable 2FA on your Supabase auth user for production.
        </p>
      </div>
    </div>
  );
}
