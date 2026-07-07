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
  css: { postcss: false as unknown as any },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron'],
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
            return 'vendor-charts';
          }
          if (id.includes('node_modules/date-fns')) {
            return 'vendor-dates';
          }
          if (id.includes('node_modules/')) {
            return 'vendor-misc';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600,
    minify: 'esbuild',
    target: 'chrome120',
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
})
