import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Planiprêt Mobile — Vite configuration
 * Point d'entrée : src/index.tsx → charge PlanipretMobileApp
 * Route cible dans le portail web : /mplanipret/*
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  base: './',
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      // Proxy vers le portail web principal en développement
      '/mplanipret': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
  define: {
    // Identifiant de l'app pour la séparation Lemtel/Planipret
    __APP_ID__: JSON.stringify('planipret'),
  },
});
