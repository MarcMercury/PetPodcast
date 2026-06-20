// Middleware: Supabase session refresh + admin auth gate + public API rate limiting.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PET_SCHEMA } from '@/lib/isolation';

// Rate-limit settings per route prefix (requests per minute).
const RATE_LIMITS: Record<string, number> = {
  '/api/subscribe': 5,
  '/api/mailbag': 10,
  '/api/breeds': 30,
};

// Simple in-memory rate limiter (same approach as lib/rate-limit.ts but
// duplicated here because middleware runs in the Edge Runtime which may not
// share the Node.js module scope with API routes).
const RL_WINDOW = 60_000;
const rlStore = new Map<string, { count: number; resetAt: number }>();

function checkRate(key: string, limit: number): boolean {
  const now = Date.now();
  let entry = rlStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RL_WINDOW };
    rlStore.set(key, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Rate-limit public POST endpoints ────────────────────────────
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) {
      const ip = clientIp(req);
      if (!checkRate(`${prefix}:${ip}`, limit)) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
      break; // matched — no need to check other prefixes
    }
  }

  // ── 2. Supabase session refresh ────────────────────────────────────
  // Refreshes the auth token on every request so server components always
  // see a valid session. Required by @supabase/ssr.
  const res = NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return res; // env not available (e.g. build)

  const supabase = createServerClient(url, anon, {
    db: { schema: PET_SCHEMA },
    cookies: {
      get: (name: string) => req.cookies.get(name)?.value,
      set: (name: string, value: string, options: any) => {
        res.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: any) => {
        res.cookies.set({ name, value: '', ...options });
      },
    },
  });

  // getUser() refreshes the session token if needed.
  const { data: { user } } = await supabase.auth.getUser();

  // ── 3. Admin route protection ──────────────────────────────────────
  // Redirect unauthenticated visitors away from /admin (except the login page).
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Run on all routes except static assets and Next internals.
    '/((?!_next/static|_next/image|favicon.ico|brand/).*)',
  ],
};
