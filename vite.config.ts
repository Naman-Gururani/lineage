import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project is served from https://naman-gururani.github.io/lineage/
export default defineConfig({
  base: '/lineage/',
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
})
