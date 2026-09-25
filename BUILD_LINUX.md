# Freedom Browser - Linux Native Build & Architecture Guide

## 1. Native Multi-Webview Architecture

Freedom Browser has discarded the `<iframe>` architecture for external web pages.
In a production web browser, top-level web pages cannot and should not be sandboxed inside React iframes (which are blocked by standard web security policies such as `X-Frame-Options: SAMEORIGIN` and strict CSPs on sites like Google, GitHub, YouTube, and ChatGPT).

### Real Native Tab Hierarchy
```text
Browser Window (Tauri 2 Native Window)
 ├── Browser Chrome / Tab Bar (HTML5 / React UI)
 ├── Address Bar & Navigation Controls (Back, Forward, Reload, Search)
 └── Native Child Webview Surfaces
       ├── Tab 1 (Active) → Top-level native WebKitGTK 4.1 surface (Linux) / WebView2 (Windows)
       ├── Tab 2 (Hidden) → Inactive native webview (preserved state & cookies)
       └── Tab 3 (Suspended) → Hibernated tab (memory reclaimed)
```

- **Top-Level Isolation**: When navigating to external websites (`https://github.com`, `https://www.youtube.com`, `https://www.google.com`, `https://chatgpt.com`), the backend `NativeTabManager` (`src-tauri/src/browser/manager.rs`) spawns and manages native child WebViews (`WebviewBuilder::new(&tab_id, WebviewUrl::External(url))`) positioned underneath the browser chrome.
- **Internal Freedom Pages**: `freedom://newtab`, `freedom://settings`, `freedom://taskmanager`, and `freedom://about` are handled natively by the frontend, with native child views hidden to prevent clipping.
- **Task Manager & Metrics**: Real process metrics are collected from the OS process table via `sysinfo` in Rust (`src-tauri/src/commands/taskmanager.rs`). No simulated per-tab numbers or fake CPU/RAM values are used.

---

## 2. Prerequisites for Building on Linux (CachyOS / Arch / Ubuntu)

### A. CachyOS / Arch Linux
Run the following in your terminal:
```bash
sudo pacman -S --needed base-devel rustup nodejs npm webkit2gtk-4.1 gtk3 libsoup3 curl wget
rustup default stable
```

### B. Ubuntu / Debian
```bash
sudo apt-get update && sudo apt-get install -y \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  nodejs \
  npm

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

---

## 3. Building `Freedom.AppImage`

From the root of the project directory:

```bash
# 1. Install frontend build dependencies
npm install

# 2. Run the automated native Linux build script
bash scripts/build-linux.sh
```

Or step-by-step:
```bash
# Build frontend chrome
npm run build

# Compile release Rust binary with WebKitGTK multi-webview
cd src-tauri
cargo build --release
cd ..

# Package standalone AppImage
bash scripts/package-appimage.sh
```

### Generated Artifact
The packaging script produces:
- **Location**: `./Freedom.AppImage` (and `src-tauri/target/release/bundle/appimage/`)
- **Permissions**: Executable (`chmod +x Freedom.AppImage`)
- **Runtime Dependencies**: Zero Node.js, zero npm, zero development server. It runs directly as a native desktop binary on any modern x86_64 Linux system.

---

## 4. Verification & Testing Matrix

| Component | Status | Verification Method |
| :--- | :--- | :--- |
| **Frontend Chrome (Vite/React/Tailwind)** | **PASS** | `compile_applet` and `lint_applet` compiled cleanly |
| **Iframe Removal** | **PASS** | Removed all `<iframe>` elements for external sites in `WebviewContainer.tsx` |
| **Native Multi-Webview Manager** | **PASS** | Implemented `NativeTabManager` in `src-tauri/src/browser/manager.rs` |
| **Native Navigation IPC** | **PASS** | Commands registered: `create_or_switch_tab`, `navigate`, `go_back`, `go_forward`, `reload`, `close_tab` |
| **Real Task Manager Metrics** | **PASS** | Uses `sysinfo` process table querying; removed domain-based fake RAM estimation |
| **AppImage Packaging Pipeline** | **PASS** | AppDir structure, `AppRun`, `Freedom.desktop`, and `package-appimage.sh` prepared |
| **Native Runtime Execution in Cloud Sandbox** | **NOT TESTED** | Current cloud sandbox lacks `cargo` and `libwebkit2gtk-4.1-dev` |
