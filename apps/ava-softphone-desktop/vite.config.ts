import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // PostCSS disabled — Tailwind is not used in this desktop app and a stray
  // postcss config in a parent dir breaks the Electron build. Mandatory.
  css: { postcss: false as unknown as any },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron', 'zod', 'zod/v4', 'zod/v3', 'ai', '@ai-sdk/provider-utils'],
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
