#!/usr/bin/env bash
# Sync + quick validation script for the native CapacitorSip plugin on iOS.
#
# Usage:
#   ./scripts/ios-sync-and-validate.sh             # full sync + open Xcode
#   ./scripts/ios-sync-and-validate.sh --check     # static checks only (no Xcode, no pod)
#
# NOTE: must be run on macOS with Xcode + CocoaPods installed for the full flow.
# The --check mode runs only file-presence + env-var validation (safe on CI).
set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-full}"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }

echo "==> 1. Verify plugin source files"
test -f ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift || { red "Missing CapacitorSip.swift"; exit 1; }
test -f ios/App/App/Plugins/CapacitorSip/CapacitorSip.m     || { red "Missing CapacitorSip.m"; exit 1; }
test -f src/lib/sip/nativeSipProvider.ts                    || { red "Missing nativeSipProvider.ts"; exit 1; }
green "OK — plugin files present."

echo "==> 1b. Verify iOS plugin is linked + bridge-registered"
PBX="ios/App/App.xcodeproj/project.pbxproj"
STORYBOARD="ios/App/App/Base.lproj/Main.storyboard"
grep -q "CapacitorSip.m in Sources" "$PBX" && green "  ✓ CapacitorSip.m is in Xcode Sources" || { red "  ✗ CapacitorSip.m is NOT in Xcode Sources — plugin will never load"; exit 1; }
grep -q "AppBridgeViewController" "$STORYBOARD" && green "  ✓ Main.storyboard uses AppBridgeViewController" || { red "  ✗ Main.storyboard still uses CAPBridgeViewController"; exit 1; }
grep -q "registerPluginInstance" ios/App/App/AppBridgeViewController.swift && green "  ✓ Local plugin registered in capacitorDidLoad" || { red "  ✗ Missing registerPluginInstance in AppBridgeViewController.swift"; exit 1; }

echo "==> 1c. Verify RTPAudioSession is RemoteIO-only"
RTP="ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift"
if grep -Eq "AVAudioEngine|AVAudioPlayerNode|installTap|removeTap" "$RTP"; then
  red "  ✗ RTPAudioSession.swift still references AVAudioEngine/AVAudioPlayerNode/installTap/removeTap"
  grep -En "AVAudioEngine|AVAudioPlayerNode|installTap|removeTap" "$RTP" || true
  exit 1
fi
grep -q "kAudioUnitSubType_RemoteIO" "$RTP" && green "  ✓ RTPAudioSession uses RemoteIO AudioUnit" || { red "  ✗ RemoteIO AudioUnit not found in RTPAudioSession.swift"; exit 1; }

echo "==> 2. Verify Info.plist keys"
PLIST="ios/App/App/Info.plist"
if [ -f "$PLIST" ]; then
  for key in NSMicrophoneUsageDescription NSLocalNetworkUsageDescription UIBackgroundModes; do
    if grep -q "$key" "$PLIST"; then green "  ✓ $key"; else red "  ✗ $key MISSING in Info.plist"; fi
  done
  grep -q "<string>voip</string>" "$PLIST" && green "  ✓ UIBackgroundModes contains voip" || yellow "  ! UIBackgroundModes missing 'voip'"
  grep -q "<string>audio</string>" "$PLIST" && green "  ✓ UIBackgroundModes contains audio" || yellow "  ! UIBackgroundModes missing 'audio'"
else
  yellow "Info.plist not found at $PLIST (run 'npx cap add ios' first)."
fi

echo "==> 3. Verify .env.local feature flag"
if [ -f .env.local ] && grep -q "VITE_NATIVE_SIP=true" .env.local; then
  green "  ✓ VITE_NATIVE_SIP=true"
else
  yellow "  ! VITE_NATIVE_SIP not enabled in .env.local — native plugin will be bypassed."
fi

if [ "$MODE" = "--check" ]; then
  green "Static check completed (--check mode). Skipping build/sync."
  exit 0
fi

echo "==> 4. Install deps"
npm install

echo "==> 5. Build web bundle"
npm run build

echo "==> 6. Capacitor sync (iOS)"
npx cap sync ios

echo "==> 7. Pod install"
( cd ios/App && pod install )

echo "==> 8. Open Xcode workspace"
open ios/App/App.xcworkspace || yellow "Could not open Xcode automatically — open ios/App/App.xcworkspace manually."

cat <<'EOF'

──────────────────────────────────────────────────────────────────
 NEXT STEPS — REAL DEVICE E2E (see docs/CAPACITOR_SIP_CHECKLIST.md)
──────────────────────────────────────────────────────────────────
  1. Plug a real iPhone (TLS:5061 does not route on Simulator).
  2. Select your team & device in Xcode → Run.
  3. In the running app, set log level to verbose for diagnostics:
       await CapacitorSipNative.setLogLevel({ level: 5 });
       await attachNativeSipLogger();
  4. Watch Xcode console for [CapacitorSip][...] lines.
  5. Run the 8 E2E scenarios in CAPACITOR_SIP_CHECKLIST.md
     (connection, register, refresh, outbound, inbound, mute, hold, unregister).
EOF
