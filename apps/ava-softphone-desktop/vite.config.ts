import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Electron loads via file:// — relative base is required to avoid a blank window.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
