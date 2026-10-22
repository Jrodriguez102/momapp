import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const src = fileURLToPath(new URL('./src', import.meta.url))

// IMPORTANT: update `base` to match your GitHub repo name before deploying,
// e.g. base: '/mom-workout-app/'
export default defineConfig(({ command, mode }) => ({
  plugins: [react(), tailwindcss()],
  base: '/momapp/',
  resolve: {
    alias: [
      // `npm run dev:fixture` only (dev server in fixture mode): swap the
      // Supabase client for the in-memory fixture. Builds never get this.
      ...(command === 'serve' && mode === 'fixture'
        ? [{ find: /^(?:\.\.\/lib\/supabase|@\/lib\/supabase)$/, replacement: `${src}/dev/fixture/fixtureClient.js` }]
        : []),
      // `@/` = src/ (shadcn/ui convention; mirrored in jsconfig.json).
      { find: '@', replacement: src },
    ],
  },
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.js'],
  },
}))
