/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Green Dog Aesthetic — clinical-yet-warm
        sage: {
          50: '#f3f8f4',
          100: '#e3efe5',
          200: '#c6dfca',
          300: '#9cc6a4',
          400: '#6ea77a',
          500: '#4d8a5b',
          600: '#3a6e47',
          700: '#305839',
          800: '#284730',
          900: '#223b29'
        },
        teal: {
          soft: '#cfe7e3',
          warm: '#7fb8b1'
        },
        clinic: '#fafbf9',
        // Petspective brand palette — clinical-media hybrid
        gallery: '#f7f7f5',   // gallery white background
        ink: '#0e1411',       // off-black for high-contrast type / dark hero
        bone: '#ecebe6'       // soft divider / chip background
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif']
      },
      letterSpacing: {
        brand: '0.18em'
      }
    }
  },
  plugins: []
};
