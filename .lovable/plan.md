
## Objectif

Transformer `/planipret/admin/overview` en un cockpit visuel premium qui agrège toutes les stats mobile/courtiers + un module financier complet avec profits par service.

## 1. Schéma DB (1 migration)

Ajouter le flag manquant pour le widget (les autres existent déjà) :

```text
ALTER TABLE planipret_profiles
  ADD COLUMN widget_enabled boolean NOT NULL DEFAULT false;
```

`mobile_app_enabled` et `voice_agent_enabled` existent déjà — réutilisés tels quels.

## 2. Modèle financier (front, configurable)

Constantes dans `src/lib/planipret/pricing.ts` :

```text
SALE_PRICE = 49.95
COST_MOBILE = 8.00      → profit 41.95/user/mois
COST_WIDGET = 18.99     → profit 30.96/user/mois
COST_AI     = 25.00     → profit 24.95/user/mois
```

Calculs : revenus, coûts, profit, marge % par service + totaux mensuels et projection annuelle (×12).

## 3. Nouvelle Vue d'ensemble — structure

```text
┌─────────────────────────────────────────────────────────────┐
│ Header : titre + filtre période (7j / 30j / 90j) + refresh │
├─────────────────────────────────────────────────────────────┤
│ Rangée 1 : 4 KPI hero (gradient glass, animation count-up)  │
│  Appels jour · Courtiers actifs · SMS jour · Sessions AVA   │
├─────────────────────────────────────────────────────────────┤
│ Rangée 2 — BLOC FINANCIER (nouveau, mise en avant)          │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐  │
│  │ Mobile   │ Widget   │ AI Agent │  TOTAL MRR / Profit  │  │
│  │ N users  │ N users  │ N users  │  Donut services      │  │
│  │ Rev/Cost │ Rev/Cost │ Rev/Cost │  Annual projection   │  │
│  │ Profit$  │ Profit$  │ Profit$  │  Marge globale %     │  │
│  └──────────┴──────────┴──────────┴──────────────────────┘  │
│  Barre empilée : Revenus vs Coûts vs Profit par service     │
├─────────────────────────────────────────────────────────────┤
│ Rangée 3 : Activité 7j (area gradient) | Distribution appels│
├─────────────────────────────────────────────────────────────┤
│ Rangée 4 : Top 5 courtiers | Leads chauds                   │
├─────────────────────────────────────────────────────────────┤
│ Rangée 5 : Activité récente | Adoption mobile (heatmap)     │
└─────────────────────────────────────────────────────────────┘
```

## 4. Stats ajoutées

- **Adoption mobile** : % courtiers avec `mobile_app_enabled=true` + dernière session
- **Engagement** : appels/courtier moyens 7j, SMS/courtier
- **Performance AI** : sessions AVA, taux de conversion lead chaud
- **Voicemails non lus**, rappels en retard, leads par température
- **Financier** : MRR, ARR, profit mensuel par service, marge globale, evolution mois précédent (delta %)

## 5. Refonte visuelle

- Système design existant `pp-card` / `--pp-*` tokens conservé (cohérence portail)
- KPI hero : gradient glass + barre d'accent gauche colorée par catégorie, micro-trend sparkline
- Cartes financières : fond gradient subtil par service (mobile=cyan, widget=orange, AI=violet), valeur principale en 36px tabular-nums, profit en vert SUCCESS si positif
- Animation count-up sur les chiffres au mount (CSS only, 600ms)
- Donut profit par service avec total au centre
- Sélecteur période en segmented control en haut à droite
- Skeleton loaders au chargement initial

## 6. Realtime

Conserver le canal `admin-overview` existant + ajouter écoute UPDATE sur `planipret_profiles` (flags) pour recalcul auto du module financier.

## Fichiers touchés

- `supabase/migrations/...` — ajout colonne `widget_enabled`
- `src/lib/planipret/pricing.ts` — nouveau, constantes + calculs
- `src/pages/planipret/admin/PAOverview.tsx` — refonte complète
- `src/components/planipret/admin/FinancialKpiCard.tsx` — nouveau
- `src/components/planipret/admin/RevenueBreakdown.tsx` — nouveau (donut + barres empilées)

## Hors scope (ce plan)

- Autres pages admin (Courtiers, Appels, etc.) — refonte ultérieure si tu veux
- Édition manuelle des flags `widget_enabled` / `voice_agent_enabled` depuis l'UI (à faire dans la page Courtiers si demandé)
