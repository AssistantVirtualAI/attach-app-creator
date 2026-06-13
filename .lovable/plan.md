## Plan

### 1. Replace the mascot with a cute 3D robot
- Rework `MascotRobot` from boxy/industrial into a small chibi-style robot:
  - round oversized head
  - rounded body
  - big expressive glowing eyes
  - visible full body
  - funny antenna/ears
  - waving/bouncing idle animation
  - mouth/talking animation when assistant replies
- Reduce the launcher size so it does not dominate the screen.
- Keep it top-right above the softphone, but make it cleaner and less intrusive.

### 2. Fix desktop portal access by role
- Make the desktop app role logic match the main portal role rules:
  - `super_admin`: access to platform portal and all organizations/domains/features
  - `org_admin` / `reseller_admin` / `manager`: access only to their customer/org portal and data
  - normal user: access only to personal workspace features
- Update desktop navigation so every available portal feature can be opened from inside the desktop app.
- Ensure super admin sees global management options; regular admins do not.

### 3. Unify portal entry points in the desktop app
- Add clear desktop sections for:
  - Platform Admin
  - Customer/Admin Portal
  - My Workspace
  - Phone System
  - Recordings / Calls
  - Users / Extensions / Gateways / IVR / Queues / Ring Groups
  - Reports / Billing / Settings / Sync Health
- Route each item to the existing working portal pages instead of placeholder/stub pages where a real page already exists.

### 4. Add a new desktop guided tour
- Add a desktop-only tour that explains:
  - role-based portal switcher
  - super admin global access
  - customer/org admin scoped access
  - softphone
  - recordings/calls
  - phone system management
  - settings and theme toggle
- Include a “Start tour” button in desktop settings/help and auto-show once for first desktop login.

### 5. Verification
- Check the desktop portal in preview/Electron routes where possible.
- Verify mascot size/placement visually.
- Verify super-admin/admin/user navigation rules from the code paths.
- Check console errors after changes.