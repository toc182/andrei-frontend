/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Colores de Pinellas Brand
        'pinellas': {
          primary: '#2c3e50',
          light: '#34495e',
          dark: '#1e2832',
        },
      },
    },
  },
  plugins: [],
}
