import { defineConfig } from 'vite'

// Served from https://naman-gururani.github.io/lineage/
export default defineConfig({
  base: '/lineage/',
  build: {
    target: 'es2020',
    assetsInlineLimit: 4096,
  },
})
