import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IMPORTANT: update `base` to match your GitHub repo name before deploying,
// e.g. base: '/mom-workout-app/'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/momapp/',
})
