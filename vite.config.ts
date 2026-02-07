import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En GitHub Pages la app vive en /nombre-repo/, en local en /
const base = process.env.GITHUB_ACTIONS ? '/unitravel/' : '/'

export default defineConfig({
  plugins: [react()],
  base,
})
