import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IMPORTANT: update `base` to match your GitHub repo name before deploying,
// e.g. base: '/mom-workout-app/'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/momapp/',
  resolve: {
    // `@/` = src/ (shadcn/ui convention; mirrored in jsconfig.json).
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.js'],
  },
})
