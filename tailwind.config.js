/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sph: {
          light: '#F2F2F2',  // Fondo principal
          text: '#6B6B6B',   // Texto principal
          primary: '#1F2D4A', // Azul marino SPH
        }
      }
    },
  },
  plugins: [],
}