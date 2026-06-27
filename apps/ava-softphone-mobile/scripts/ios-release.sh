#!/usr/bin/env bash
# AVA Softphone — iOS release build helper.
# Run from apps/ava-softphone-mobile/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "▶ Installing JS deps"
npm install

echo "▶ Building web bundle"
npm run build

echo "▶ Syncing iOS project"
npx cap sync ios

echo "▶ Running launch validator"
bash scripts/validate-ios-launch.sh || true

cat <<'NEXT'

✅ Ready for Xcode.

Next steps:
  1. open ios/App/App.xcworkspace
  2. Select target "App" → Signing & Capabilities
       • Team set, automatic signing on
       • Capabilities: Push Notifications, Background Modes (Audio,
         Remote notifications)
  3. Bump MARKETING_VERSION / CURRENT_PROJECT_VERSION if needed
  4. Product → Archive → Distribute App → App Store Connect → Upload
  5. In App Store Connect:
       • Fill Privacy Details to match ios/App/App/PrivacyInfo.xcprivacy
       • Confirm Export Compliance = Standard encryption only
       • Attach screenshots (6.7" + 6.5", FR + EN)
       • Submit to TestFlight, then for App Review

See docs/app-store-review-checklist.md for the full pre-submission list.
NEXT
