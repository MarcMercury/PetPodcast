import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Petspective — See Your Pet Through a Vet’s Eyes',
  description:
    'Petspective: clinical-grade conversations with practicing veterinarians on nutrition, surgery, behavior, and the questions every pet owner Googles at 2am.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.podcast.pet'),
  openGraph: {
    title: 'Petspective',
    description: 'See Your Pet Through a Vet’s Eyes.',
    url: 'https://www.podcast.pet',
    siteName: 'Petspective',
    type: 'website',
    images: [{ url: '/brand/title-cover.png', width: 1500, height: 1000, alt: 'Petspective — See Your Pet Through a Vet’s Eyes' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Petspective',
    description: 'See Your Pet Through a Vet’s Eyes.',
    images: ['/brand/title-cover.png']
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,800;1,500;1,700&display=swap"
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

function Wordmark() {
  // Mirrors the cover wordmark: serif "Pet-" in cream + italic sage "spective".
  return (
    <span className="wordmark text-2xl leading-none flex items-baseline">
      <span className="pet">Pet-</span>
      <span className="spective">spective</span>
    </span>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-ink/75 border-b border-bone">
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <Wordmark />
        </a>
        <nav className="flex items-center gap-6 text-sm text-sage-200">
          <a href="/#episodes" className="hover:text-sage-300 transition">Episodes</a>
          <a href="/breeds" className="hover:text-sage-300 transition">Breeds</a>
          <a href="/#vets" className="hover:text-sage-300 transition">The Pack</a>
          <a href="/recalls" className="hover:text-sage-300 transition">Recalls</a>
          <a href="/#ask" className="hover:text-sage-300 transition">Ask a Vet</a>
          <a href="/admin" className="btn-ghost text-xs py-1.5">Studio</a>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-bone bg-ink">
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-sage-300 flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <Wordmark />
          <span className="text-sage-500/70">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex flex-col sm:items-end gap-1">
          <a
            href="mailto:petpodcast.pet@gmail.com"
            className="text-sage-200 hover:text-cream underline-offset-4 hover:underline"
          >
            petpodcast.pet@gmail.com
          </a>
          <p className="deck-label text-[10px] text-sage-300/70">
            See Your Pet Through a Vet’s Eyes
          </p>
        </div>
      </div>
    </footer>
  );
}
