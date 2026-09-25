#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo " PACKAGING STANDALONE FREEDOM.APPIMAGE"
echo "=========================================================="

APP_DIR="dist-appimage/Freedom.AppDir"
rm -rf dist-appimage
mkdir -p "$APP_DIR/usr/bin"
mkdir -p "$APP_DIR/usr/share/icons/hicolor/512x512/apps"
mkdir -p "$APP_DIR/usr/share/applications"

echo "[+] Copying binaries and metadata..."
if [ -f "src-tauri/target/release/freedom" ]; then
  cp "src-tauri/target/release/freedom" "$APP_DIR/usr/bin/freedom"
  chmod +x "$APP_DIR/usr/bin/freedom"
else
  echo "[!] Compiling Rust release binary first..."
  npm run build
  cd src-tauri && cargo build --release && cd ..
  cp "src-tauri/target/release/freedom" "$APP_DIR/usr/bin/freedom"
  chmod +x "$APP_DIR/usr/bin/freedom"
fi

cp scripts/AppRun "$APP_DIR/AppRun"
chmod +x "$APP_DIR/AppRun"

cp scripts/Freedom.desktop "$APP_DIR/Freedom.desktop"
cp scripts/Freedom.desktop "$APP_DIR/usr/share/applications/Freedom.desktop"
cp src-tauri/icons/icon.png "$APP_DIR/freedom.png"
cp src-tauri/icons/icon.png "$APP_DIR/.DirIcon"
cp src-tauri/icons/icon.png "$APP_DIR/usr/share/icons/hicolor/512x512/apps/freedom.png"

echo "[+] Checking for appimagetool..."
if ! command -v appimagetool &> /dev/null; then
  echo "[*] Downloading portable appimagetool..."
  wget -q -O ./appimagetool "https://github.com/AppImage/AppImageKit/releases/download/13/appimagetool-x86_64.AppImage" || true
  chmod +x ./appimagetool || true
  TOOL="./appimagetool"
else
  TOOL="appimagetool"
fi

if [ -f "$TOOL" ]; then
  ARCH=x86_64 "$TOOL" "$APP_DIR" "Freedom.AppImage"
  echo "[+] Generated Freedom.AppImage successfully!"
else
  echo "[*] AppDir structure prepared at $APP_DIR. Run appimagetool to create .AppImage."
fi
