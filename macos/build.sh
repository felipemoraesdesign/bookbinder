#!/bin/sh
# Builds macos/build/Miolo.app: the web app bundled inside a native Swift window.
# Needs Node and the Xcode Command Line Tools. Usage: sh macos/build.sh
set -e
cd "$(dirname "$0")/.."

APP=macos/build/Miolo.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

BASE=/ npx vite build --outDir "$APP/Contents/Resources/web" --emptyOutDir
sed "s/__VERSION__/$(node -p "require('./package.json').version")/" macos/Info.plist > "$APP/Contents/Info.plist"
cp macos/AppIcon.icns "$APP/Contents/Resources/"

# One binary for both Apple silicon and Intel Macs
for arch in arm64 x86_64; do
  swiftc -O -swift-version 5 -target "$arch-apple-macos12" macos/Miolo.swift -o "macos/build/Miolo-$arch"
done
lipo -create macos/build/Miolo-arm64 macos/build/Miolo-x86_64 -output "$APP/Contents/MacOS/Miolo"
rm macos/build/Miolo-arm64 macos/build/Miolo-x86_64

# Ad-hoc signature: runs on this Mac. Sharing it needs a Developer ID signature and notarization.
codesign --force --sign - "$APP"
echo "Built $APP ($(du -sh "$APP" | cut -f1))"
