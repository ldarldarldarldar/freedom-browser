#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo " FREEDOM BROWSER - NATIVE DESKTOP BUILD PIPELINE"
echo " Target: Linux AppImage (WebKitGTK 4.1 / Tauri 2 Native)"
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

# 1. Detect Linux Distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  echo "[+] Detected Linux Distribution: ${NAME:-Linux} (${ID:-generic})"
fi

# 2. Check Package Prerequisites
echo "[+] Checking build toolchain..."

MISSING_DEPS=0

if ! command -v cargo &> /dev/null; then
  echo "[-] 'cargo' (Rust toolchain) not found in PATH."
  MISSING_DEPS=1
fi

if ! command -v npm &> /dev/null; then
  echo "[-] 'npm' (Node package manager) not found in PATH."
  MISSING_DEPS=1
fi

if [ "$MISSING_DEPS" -eq 1 ]; then
  echo ""
  echo "[!] Missing build dependencies. To install prerequisites:"
  if [ "${ID:-}" = "arch" ] || [ "${ID_LIKE:-}" = "arch" ] || [ "${ID:-}" = "cachyos" ]; then
    echo "    sudo pacman -S --needed base-devel rustup nodejs npm webkit2gtk-4.1 gtk3 libsoup3 curl wget"
    echo "    rustup default stable"
  else
    echo "    sudo apt-get update && sudo apt-get install -y build-essential curl wget libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev nodejs npm"
    echo "    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  fi
  exit 1
fi

# 3. Check for WebKitGTK 4.1 via pkg-config
if command -v pkg-config &> /dev/null; then
  if pkg-config --exists webkit2gtk-4.1; then
    echo "[+] Found webkit2gtk-4.1 ($(pkg-config --modversion webkit2gtk-4.1))"
  elif pkg-config --exists webkit2gtk-4.0; then
    echo "[!] Found webkit2gtk-4.0 ($(pkg-config --modversion webkit2gtk-4.0)). Note: webkit2gtk-4.1 is recommended."
  else
    echo "[!] Warning: webkit2gtk development headers not found via pkg-config."
    if [ "${ID:-}" = "cachyos" ] || [ "${ID:-}" = "arch" ]; then
      echo "    Install with: sudo pacman -S webkit2gtk-4.1"
    else
      echo "    Install with: sudo apt-get install libwebkit2gtk-4.1-dev"
    fi
  fi
fi

# 4. Step 1: Compile Frontend Assets (Vite)
echo ""
echo "[+] Step 1: Building production frontend chrome assets..."
npm run build

# 5. Step 2: Compile Native Freedom Rust Core
echo ""
echo "[+] Step 2: Compiling native Freedom Rust core with multi-webview engine..."
cd "$ROOT_DIR/src-tauri"
cargo build --release
cd "$ROOT_DIR"

# 6. Step 3: Package Standalone Freedom.AppImage
echo ""
echo "[+] Step 3: Packaging standalone Freedom.AppImage..."
bash "$ROOT_DIR/scripts/package-appimage.sh"

if [ -f "$ROOT_DIR/Freedom.AppImage" ]; then
  chmod +x "$ROOT_DIR/Freedom.AppImage"
  echo ""
  echo "=========================================================="
  echo " SUCCESS! Standalone Freedom.AppImage is ready:"
  echo " Path: $ROOT_DIR/Freedom.AppImage"
  ls -lh "$ROOT_DIR/Freedom.AppImage"
  echo "=========================================================="
  echo "To launch: ./Freedom.AppImage"
else
  echo ""
  echo "[+] Binary compiled at: $ROOT_DIR/src-tauri/target/release/freedom"
fi
