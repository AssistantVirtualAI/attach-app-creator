/**
 * Planiprêt Mobile — Point d'entrée Capacitor
 * App ID : com.planipret.mobile
 *
 * Ce fichier est le bootstrap natif (iOS/Android).
 * Il charge l'app React qui pointe vers /mplanipret/* du portail web AVA.
 * La séparation Lemtel/Planipret est garantie par :
 *   - AppSeparationGuard (côté web)
 *   - MplanipretGuard (côté web)
 *   - requirePlanipretBroker (côté Edge Functions)
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import PlanipretMobileApp from './PlanipretMobileApp';
import './styles.css';

async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    try {
      // Barre de statut : style sombre sur fond bleu Planiprêt
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1A4A8A' });
    } catch {}
    try {
      await SplashScreen.hide();
    } catch {}
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Root element not found');

  const root = createRoot(container);
  root.render(<PlanipretMobileApp />);
}

bootstrap().catch(console.error);
