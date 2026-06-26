#!/usr/bin/env bash
# Sync + quick validation script for the native CapacitorSip plugin on iOS.
# Usage: ./scripts/ios-sync-and-validate.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 1. Install deps"
npm install

echo "==> 2. Build web bundle"
npm run build

echo "==> 3. Capacitor sync (iOS)"
npx cap sync ios

echo "==> 4. Pod install"
( cd ios/App && pod install )

echo "==> 5. Check plugin files are present"
test -f ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift
test -f ios/App/App/Plugins/CapacitorSip/CapacitorSip.m
grep -q "VITE_NATIVE_SIP=true" .env.local || echo "WARN: VITE_NATIVE_SIP not enabled in .env.local"

echo "==> 6. Open Xcode workspace"
open ios/App/App.xcworkspace

cat <<'EOF'

Manual checklist on device:
  [ ] Build & Run on a real iOS device (TLS:5061 won't work on Simulator network).
  [ ] Accept Microphone + Local Network prompts.
  [ ] Watch Xcode console: "registration { status: 'registered' }" within 5s.
  [ ] Place outbound call -> CallKit UI appears, audio is two-way.
  [ ] Receive inbound call -> native CallKit ringer + answer/decline works.
  [ ] Background app for 5 min -> REGISTER refresh keeps presence (Expires=300, refresh 240s).
  [ ] Kill app / call disconnect() -> server shows UNREGISTER (Expires: 0).
EOF
