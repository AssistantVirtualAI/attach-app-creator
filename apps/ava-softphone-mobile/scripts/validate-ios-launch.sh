#!/usr/bin/env bash
# Launch validation: ensures Main.storyboard references AppBridgeViewController
# (not raw CAPBridgeViewController) and that the plugin sources are linked.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STORYBOARD="$ROOT/ios/App/App/Base.lproj/Main.storyboard"
PBXPROJ="$ROOT/ios/App/App.xcodeproj/project.pbxproj"

fail=0

echo "── Storyboard customClass check"
if grep -q 'customClass="CAPBridgeViewController"' "$STORYBOARD"; then
    echo "❌ Main.storyboard still references CAPBridgeViewController directly"
    fail=1
fi
if ! grep -q 'customClass="AppBridgeViewController"' "$STORYBOARD"; then
    echo "❌ Main.storyboard missing AppBridgeViewController reference"
    fail=1
else
    echo "✅ Main.storyboard → AppBridgeViewController"
fi
if ! grep -q 'customModule="App"' "$STORYBOARD"; then
    echo "❌ Missing customModule=\"App\" on the bridge VC (Swift class won't resolve)"
    fail=1
else
    echo "✅ customModule=\"App\" set"
fi

echo "── Xcode target sources"
for f in "CapacitorSip.swift in Sources" "CapacitorSip.m in Sources" "AppBridgeViewController.swift in Sources"; do
    if grep -q "$f" "$PBXPROJ"; then
        echo "✅ $f"
    else
        echo "❌ Missing in Sources build phase: $f"
        fail=1
    fi
done

if [ "$fail" -ne 0 ]; then
    echo ""
    echo "Launch validation FAILED — fix above before building."
    exit 1
fi
echo ""
echo "All launch checks passed."
