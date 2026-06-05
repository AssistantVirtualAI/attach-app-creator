import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tailwindcss = require(path.resolve(__dirname, 'node_modules/tailwindcss'));
const autoprefixer = require(path.resolve(__dirname, 'node_modules/autoprefixer'));

export default defineConfig({
  plugins: [react()],
  css: {
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
  root: __dirname,
  server: {
    port: 5173,
    strictPort: true,
  },
});
