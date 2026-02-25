

# Implementation Plan: 4 New Features + Landing Page Updates

## Overview

This plan covers implementing four features and showcasing them on the landing page (FR/EN):

1. **RBAC Enhancement** — Already implemented in backend (`user_roles`, `org_role_permissions`, `usePermissions`). Need a polished **UI settings panel** for managing role-permission matrix visually.
2. **Custom Tags** — Extend existing `SmartTags` system to support user-created custom tags on conversations (replacing static "Mark As Reviewed" / "Saved For Later").
3. **Data View** — A new conversation list view with preset filter tabs (e.g., "Unresolved", "High Priority", "This Week") and saved custom views.
4. **Embedded Iframe & Expanded Analytics** — Iframe widget already exists at `/iframe/:agentId`. Enhance with analytics overlay and new dashboard widgets.

---

## Technical Details

### 1. RBAC Settings UI

**Files to create/edit:**
- `src/components/settings/RolePermissionMatrix.tsx` — Interactive grid (roles × permissions) with toggle switches, using existing `useOrgRolePermissions` and `useUpsertOrgRolePermission` hooks
- Wire into the existing Settings page under a "Roles & Permissions" tab

**No database changes needed** — `org_role_permissions` table and edge function already exist.

### 2. Custom Tags

**Database migration:**
```sql
CREATE TABLE public.custom_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  icon text DEFAULT 'tag',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.custom_tags ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read, managers+ can manage
CREATE POLICY "Members can view custom tags" ON public.custom_tags
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = custom_tags.organization_id
    AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Managers can manage custom tags" ON public.custom_tags
  FOR ALL USING (
    has_role(auth.uid(), organization_id, 'manager'::app_role)
    OR has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR is_super_admin(auth.uid())
  ) WITH CHECK (
    has_role(auth.uid(), organization_id, 'manager'::app_role)
    OR has_role(auth.uid(), organization_id, 'org_admin'::app_role)
    OR is_super_admin(auth.uid())
  );

CREATE TABLE public.conversation_tags (
  conversation_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  tagged_by uuid,
  tagged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, tag_id)
);

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
-- Similar RLS policies
```

**Files to create/edit:**
- `src/hooks/useCustomTags.ts` — CRUD hooks for custom tags
- `src/components/conversations/CustomTagPicker.tsx` — Popover to add/remove tags from a conversation
- Update `ConversationDetailModal.tsx` and `ElevenLabsConversationModal.tsx` to show custom tags
- Remove any "Mark As Reviewed" / "Saved For Later" static buttons (none found in current codebase, so this is already clean)

### 3. Data View (Preset Filters)

**Files to create/edit:**
- `src/components/conversations/ConversationDataView.tsx` — Tab bar with preset views:
  - **All** | **Unresolved** | **Negative Sentiment** | **This Week** | **High Duration** | **Tagged**
- Each preset applies filters to the existing conversation query
- `src/hooks/useConversationViews.ts` — Manages active view state and filter mapping
- Integrate into the main Conversations page as an alternative layout toggle

**No database changes needed** — uses existing `resolution_status`, `sentiment`, `smart_tags`, `created_at`, and `duration` columns on `conversations`.

### 4. Embedded Iframe & Expanded Analytics

**Iframe enhancements** (edit `src/pages/WidgetIframe.tsx`):
- Add optional `?showAnalytics=true` query param to display a mini analytics overlay (conversation count, avg satisfaction)
- Add `postMessage` API for parent pages to control the widget

**Expanded Analytics** (edit/create):
- `src/components/analytics/ConversationFunnel.tsx` — Funnel chart: Total → Engaged → Resolved → Satisfied
- `src/components/analytics/TagDistributionChart.tsx` — Pie/bar chart of custom tag usage
- `src/components/analytics/PeakHoursHeatmap.tsx` — Heatmap of conversation volume by hour/day
- Wire into the existing Dashboard analytics section

---

### 5. Landing Page — New "What's New" Section

**Create:** `src/components/landing/WhatsNewSection.tsx`
- A visually rich section with 4 cards (one per feature), each with:
  - Icon, title, description, and a mini animated preview (like existing `FeatureAnimation`)
  - Auto-cycling highlight with smooth transitions

**Edit locales** (`src/locales/fr.ts` and `src/locales/en.ts`):

```text
whatsNew:
  badge: "Nouveautés" / "What's New"
  title: "Les dernières fonctionnalités" / "Latest Features"
  subtitle: "..." / "..."
  rbac:
    title: "Contrôle d'accès par rôle (RBAC)" / "Role-Based Access Control (RBAC)"
    description: "Sécurité renforcée..." / "Enhanced security..."
  customTags:
    title: "Tags personnalisés" / "Custom Tags"
    description: "Organisez vos conversations..." / "Organize your conversations..."
  dataView:
    title: "Vue données" / "Data View"
    description: "Navigation simplifiée..." / "Streamlined navigation..."
  embedded:
    title: "Iframe intégré & Analytics étendus" / "Embedded Iframe & Expanded Analytics"
    description: "Insights approfondis..." / "Deeper insights..."
```

**Edit `src/pages/Landing.tsx`:**
- Add `<WhatsNewSection />` between the Features section and Live Demo section

---

## Implementation Order

1. Custom Tags (DB migration + hooks + UI components)
2. Data View (preset filters component)
3. RBAC Settings UI (matrix grid)
4. Expanded Analytics (new chart components)
5. Iframe enhancements
6. Landing page "What's New" section with FR/EN translations
7. Testing end-to-end

