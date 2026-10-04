import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // Tailwind v4 uses a Vite plugin — no postcss config needed
  ],
  server: { port: 5173 }
})
