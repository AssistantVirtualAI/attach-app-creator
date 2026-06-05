import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Load tailwind and autoprefixer from the app's own node_modules using
// absolute paths to prevent Vite from walking up to the repo root postcss.config.js
const tailwindcss = require(path.resolve(__dirname, 'node_modules/tailwindcss'));
const autoprefixer = require(path.resolve(__dirname, 'node_modules/autoprefixer'));

export default defineConfig({
  plugins: [react()],
  css: {
    // Inline PostCSS config — bypasses ALL file discovery.
    // Vite will NOT search for postcss.config.js anywhere.
    postcss: {
      plugins: [
        tailwindcss({
          config: path.resolve(__dirname, 'tailwind.config.js'),
        }),
        autoprefixer(),
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['electron'],
    },
  },
  base: './',
  // Critical: set root explicitly to THIS folder so Vite doesn't treat the
  // repo root as the project root (which would re-discover root postcss.config.js).
  root: __dirname,
  server: {
    port: 5173,
    strictPort: true,
  },
});
