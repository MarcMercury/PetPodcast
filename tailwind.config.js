/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Petspective — Vet's Eye View palette (driven by the cover art).
        sage: {
          50: '#f3f8f4',
          100: '#e3efe5',
          200: '#c6dfca',
          300: '#9cc6a4', // primary accent on dark — matches "spective" green
          400: '#7fb091',
          500: '#5e9472',
          600: '#467558',
          700: '#345b44',
          800: '#244334',
          900: '#172d22'
        },
        teal: {
          soft: '#cfe7e3',
          warm: '#7fb8b1'
        },
        clinic: '#0e1411',
        // Surface tokens flipped to "studio dark" — the cover is the brand.
        gallery: '#0b110e',     // page background (deep ink-green)
        ink: '#080d0a',          // hero / footer / heaviest dark surface
        'ink-soft': '#121a16',   // card / panel surface
        bone: '#1d2a22',         // divider / hairline rule on dark
        cream: '#ece9df'         // primary body type on dark
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Playfair Display = the serif on the cover wordmark.
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        // Montserrat for tracked uppercase decks ("VET'S EYE VIEW").
        deck: ['Montserrat', 'Inter', 'sans-serif']
      },
      letterSpacing: {
        brand: '0.18em',
        deck: '0.32em'
      }
    }
  },
  plugins: []
};
