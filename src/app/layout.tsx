import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pet Podcast — Real Vets. Real Advice. Real Pet Stories.',
  description:
    'Premium veterinary podcasts from Green Dog and trusted vets. Listen to real advice on dogs, cats, exotics, nutrition, surgery, and wellness.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.podcast.pet'),
  openGraph: {
    title: 'Pet Podcast',
    description: 'Real Vets. Real Advice. Real Pet Stories.',
    url: 'https://www.podcast.pet',
    siteName: 'Pet Podcast',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-clinic/80 border-b border-sage-100">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-display font-bold text-xl">
          <span aria-hidden>🐾</span> Pet Podcast
        </a>
        <nav className="flex items-center gap-6 text-sm">
          <a href="/#episodes" className="hover:text-sage-600">Episodes</a>
          <a href="/#vets" className="hover:text-sage-600">Vets</a>
          <a href="/#ask" className="hover:text-sage-600">Ask a Vet</a>
          <a href="/admin" className="btn-ghost text-xs py-1.5">Admin</a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-sage-100 bg-white/60">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-sage-700 flex flex-col sm:flex-row justify-between gap-4">
        <p>© {new Date().getFullYear()} Pet Podcast — a Green Dog production.</p>
        <p className="text-sage-500">Real Vets. Real Advice. Real Pet Stories.</p>
      </div>
    </footer>
  );
}
