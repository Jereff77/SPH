/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1e293b',
        'navy-hover': '#334155',
        brand: '#3b82f6',
      },
    },
  },
  plugins: [],
}

