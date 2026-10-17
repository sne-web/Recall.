import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Mirrors the /api rewrite in vercel.json, so the app uses relative /api URLs everywhere
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
})
