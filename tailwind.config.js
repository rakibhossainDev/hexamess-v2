/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hind Siliguri"', 'sans-serif'],
        solaiman: ['SolaimanLipi', 'sans-serif'],
      },
      colors: {
        background: 'var(--bg-color)',
        surface: 'var(--surface-color)',
        primary: 'var(--primary-color)',
        secondary: 'var(--text-secondary)',
        accent: {
          blue: 'var(--accent-blue)',
          green: 'var(--accent-green)',
          orange: 'var(--accent-orange)',
          red: 'var(--accent-red)'
        }
      }
    },
  },
  plugins: [],
}

