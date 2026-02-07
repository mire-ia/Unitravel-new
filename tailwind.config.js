/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#C4842D',
        secondary: '#2D5A27',
        highlight: '#F5A623',
        positive: '#28A745',
        negative: '#DC3545',
      },
    },
  },
  plugins: [],
}
