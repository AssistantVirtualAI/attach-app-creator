import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        // Use require with full absolute path from __dirname.
        // This guarantees we use the app's own node_modules
        // and never trigger postcss.config.js file search.
        require(path.join(__dirname, 'node_modules', 'tailwindcss'))({
          config: path.join(__dirname, 'tailwind.config.js'),
        }),
        require(path.join(__dirname, 'node_modules', 'autoprefixer'))(),
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
      output: {
        format: 'cjs',
      },
    },
  },
  base: './',
  root: path.resolve(__dirname),
  envDir: path.resolve(__dirname),
});
