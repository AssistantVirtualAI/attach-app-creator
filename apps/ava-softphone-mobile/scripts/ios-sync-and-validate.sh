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

echo "==> 1a. Verify no stale duplicate CapacitorPjsip plugin remains"
if [ -d ios/App/App/Plugins/CapacitorPjsip ]; then
  if find ios/App/App/Plugins/CapacitorPjsip -type f | grep -q .; then
    red "  ✗ Stale duplicate plugin files found under ios/App/App/Plugins/CapacitorPjsip"
    find ios/App/App/Plugins/CapacitorPjsip -type f -maxdepth 1 -print
    exit 1
  fi
fi
if grep -R "CAP_PLUGIN(CapacitorPjsip" -n ios/App --exclude-dir=Pods --exclude-dir=build | grep -v "Plugins/CapacitorSip"; then
  red "  ✗ Duplicate/incomplete CAP_PLUGIN(CapacitorPjsip) declaration found"
  exit 1
fi
green "  ✓ No stale duplicate plugin declarations"

echo "==> 1b. Verify iOS plugin is linked + bridge-registered"
PBX="ios/App/App.xcodeproj/project.pbxproj"
STORYBOARD="ios/App/App/Base.lproj/Main.storyboard"
grep -q "CapacitorSip.m in Sources" "$PBX" && green "  ✓ CapacitorSip.m is in Xcode Sources" || { red "  ✗ CapacitorSip.m is NOT in Xcode Sources — plugin will never load"; exit 1; }
grep -q "AppBridgeViewController" "$STORYBOARD" && green "  ✓ Main.storyboard uses AppBridgeViewController" || { red "  ✗ Main.storyboard still uses CAPBridgeViewController"; exit 1; }
grep -q "registerPluginInstance" ios/App/App/AppBridgeViewController.swift && green "  ✓ Local plugin registered in capacitorDidLoad" || { red "  ✗ Missing registerPluginInstance in AppBridgeViewController.swift"; exit 1; }

echo "==> 1c. Verify PJSIP wrapper is in place (custom RTPAudioSession removed)"
if [ -f ios/App/App/Plugins/CapacitorSip/RTPAudioSession.swift ]; then
  red "  ✗ RTPAudioSession.swift still present — should be deleted (PJSIP owns audio now)"
  exit 1
fi
grep -q "pjsua_create" ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift \
  && green "  ✓ CapacitorSip.swift wraps PJSIP (pjsua API in use)" \
  || { red "  ✗ CapacitorSip.swift does not reference pjsua — PJSIP integration missing"; exit 1; }
grep -q "pod 'pjsip'" ios/App/Podfile \
  && green "  ✓ Podfile declares pjsip pod" \
  || { red "  ✗ Podfile missing pjsip pod"; exit 1; }


echo "==> 1d. Verify native call-control methods are exposed"
for method in startRecord stopRecord transfer park addCall requestMicrophonePermission getRtpStats playTestTone; do
  grep -q "CAPPluginMethod(name: \"$method\"" ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift \
    && green "  ✓ $method" \
    || { red "  ✗ $method missing from CapacitorSip.swift pluginMethods"; exit 1; }
done

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
