# Freedom Browser

```
   ███████╗██████╗ ███████╗███████╗██████╗  ██████╗ ███╗   ███╗
   ██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗██╔═══██╗████╗ ████║
   █████╗  ██████╔╝█████╗  █████╗  ██║  ██║██║   ██║██╔████╔██║
   ██╔══╝  ██╔══██╗██╔══╝  ██╔══╝  ██║  ██║██║   ██║██║╚██╔╝██║
   ██║     ██║  ██║███████╗███████╗██████╔╝╚██████╔╝██║ ╚═╝ ██║
   ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝
```

**Freedom** is a lightweight, fast, privacy-focused cross-platform desktop web browser built around three core principles:
1. **Freedom** — Digital autonomy, zero tracking, zero remote telemetry.
2. **Programming** — Integrated developer console, network inspector, WebAssembly & DOM inspection.
3. **Speed** — Low RAM usage, idle tab hibernation, hardware acceleration, and rapid startup.

---

## 1. Project Overview

Freedom is an actual desktop application built with a native Rust backend and Tauri 2.x, interfacing with the operating system's native modern browser engine:
- **Windows 10/11**: Microsoft Edge WebView2 (Chromium engine with system-level optimization).
- **Linux (Arch, CachyOS, Fedora, Debian/Ubuntu)**: WebKitGTK (Safari/WebKit engine with native GTK3 integration).

Freedom delivers compatibility with modern web standards:
- **HTML5 & CSS3**: Flexbox, CSS Grid, animations, modern viewport units.
- **Modern JavaScript**: ES2024+, async/await, Service Workers, Web Workers.
- **WebAssembly (Wasm)**: Fast client-side computation.
- **WebGL & WebGL2**: GPU-accelerated 3D and 2D canvas rasterization.
- **Hardware Acceleration**: Video decoding, GPU compositing.
- **Storage & Networking**: Cookies, LocalStorage, IndexedDB, WebSockets, HTTPS/TLS 1.3, file uploads and downloads.

---

## 2. Architecture & Directory Structure

Freedom uses a strict separation between the native platform layer and the minimal browser user interface:

```
├── src/                               # Frontend Browser UI & Shell
│   ├── browser/
│   │   ├── types.ts                   # Tab, download, log, bookmark types
│   │   └── WebviewContainer.tsx       # Embedded webview container & sandbox host
│   ├── components/
│   │   ├── DevToolsDrawer.tsx         # In-browser developer tools, console & network inspector
│   │   ├── DownloadDrawer.tsx         # Download manager popover & progress tracker
│   │   ├── FreedomLogo.tsx            # Minimalist mint "F" in dark green shield
│   │   ├── Navigation.tsx             # Back, Forward, Reload, Home, Omni bar, Menu
│   │   ├── StarCanvas.tsx             # GPU-accelerated subtle moving star field
│   │   └── TabBar.tsx                 # Desktop tab bar with audio & hibernation indicators
│   ├── pages/
│   │   ├── AboutModal.tsx             # Freedom version, engine details & open-source license
│   │   ├── ErrorPage.tsx              # Error handler (DNS, offline, certificate, crashed tab)
│   │   ├── NewTabPage.tsx             # Clean start page with digital clock & quick shortcuts
│   │   ├── SettingsModal.tsx          # Full settings (Search, Privacy, Telemetry, Visual, RAM)
│   │   └── TaskManagerModal.tsx       # Real-time process inspector with CPU & RAM metrics
│   ├── services/
│   │   ├── loggerService.ts           # Zero-telemetry local diagnostics logger
│   │   ├── searchEngineService.ts     # Omni bar URL resolution & search engine provider
│   │   └── tauriBridge.ts             # Safe IPC bridge between React and Rust Tauri backend
│   ├── settings/
│   │   ├── defaults.ts                # Default browser settings & search engines
│   │   └── types.ts                   # Settings schema
│   ├── taskmanager/
│   │   └── types.ts                   # Task manager process metric definitions
│   ├── App.tsx                        # Main application orchestrator & keyboard shortcuts
│   └── main.tsx                       # Entry point
│
├── src-tauri/                         # Native Rust Core (Desktop Backend)
│   ├── Cargo.toml                     # Rust 2021 crate dependencies
│   ├── tauri.conf.json                # Tauri 2 configuration (window, permissions, bundles)
│   ├── build.rs                       # Tauri build script
│   ├── icons/                         # Desktop application icons (32x32, 128x128, 512x512, ico)
│   └── src/
│       ├── main.rs                    # Entry point for native binary
│       ├── lib.rs                     # Tauri plugin initialization & IPC handlers
│       ├── commands/
│       │   ├── browser.rs             # Window title, devtools, close app
│       │   ├── downloads.rs           # Native file download & folder launcher
│       │   ├── logging.rs             # Local diagnostic file writer
│       │   ├── settings.rs            # Native settings persistence
│       │   └── taskmanager.rs         # Real system process metrics & termination
│       ├── browser/
│       │   └── manager.rs             # Webview tab memory management
│       ├── system/
│       │   └── metrics.rs             # Real OS memory & CPU inspection using sysinfo
│       └── taskmanager/
│           └── process_info.rs        # Process termination & memory reclamation
│
├── scripts/
│   ├── AppRun                         # AppImage execution launcher
│   ├── Freedom.desktop                # Linux desktop menu & mime-type entry
│   ├── build-linux.sh                 # Linux compilation & AppImage generator
│   ├── build-windows.ps1              # Windows PowerShell compilation script
│   ├── generate-icons.js              # Vector-to-raster icon asset generator
│   └── package-appimage.sh            # Standalone AppImage bundler
└── public/
    ├── logo.svg                       # Official brand vector
    └── icon.png                       # High-resolution raster asset
```

---

## 3. Dependencies

### End-User Dependencies (ZERO Runtime Requirements)

The final distributed application is a self-contained native executable:
- **Windows**: `Freedom.exe` or `Freedom-setup.exe` (uses built-in Windows WebView2 runtime).
- **Linux**: `Freedom.AppImage` (runs on Arch, CachyOS, Fedora, Debian, Ubuntu).
- **Node.js, npm, Rust, Cargo, or Python are NOT required** on the user's computer to run Freedom.

### Developer Build-Time Requirements

To compile Freedom from source:
1. **Node.js & npm** (v18 or higher) — for bundling the UI.
2. **Rust & Cargo** (v1.75 or higher) — for compiling the native browser core.
3. Platform-specific build tools:
   - **Linux**: `gcc`, `pkg-config`, `libwebkit2gtk-4.1-dev` (or `4.0`), `libgtk-3-dev`, `libayatana-appindicator3-dev`.
   - **Windows**: Microsoft C++ Build Tools (Visual Studio Build Tools) and Windows 10/11 SDK.

---

## 4. Development Commands

Run the browser in development mode with live interface reloading:

```bash
# Install frontend dependencies
npm install

# Run the local preview (port 3000)
npm run dev

# Run inside native desktop window with Tauri 2
cargo tauri dev
```

---

## 5. Production Build Commands

### Building for Linux (.AppImage & .deb)

On modern Linux distributions (Arch, CachyOS, Fedora, Ubuntu):

```bash
# 1. Install system prerequisites (Ubuntu/Debian example)
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# 2. Compile frontend and native binary
npm run build
cd src-tauri
cargo build --release

# 3. Create the standalone AppImage
cd ..
./scripts/build-linux.sh
```

The resulting package is located at:
`src-tauri/target/release/bundle/appimage/Freedom_1.0.0_amd64.AppImage`

Make it executable and launch directly:
```bash
chmod +x Freedom.AppImage
./Freedom.AppImage
```

### 5. Building Freedom Browser (.AppImage for Linux & .exe for Windows)

Freedom supports full native cross-platform desktop compilation using Electron and Chromium webviews:

#### A. Linux `.AppImage` (x86_64)
Run from the root directory:
```bash
npm run build:appimage
```
- **Generated File**: `release/Freedom-1.0.0.AppImage` (and `./Freedom.AppImage`)
- **Execution**: `chmod +x ./Freedom.AppImage && ./Freedom.AppImage`
- **Features**: Standalone, portable, works out of the box on all modern Linux distributions (Arch, CachyOS, Ubuntu, Fedora, Debian) without installing extra dependencies.

#### B. Windows `.exe` & Distribution Package
Run on Linux or Windows:
```bash
npm run build:win
```
- **Generated Files**:
  - `release/Freedom 1.0.0.exe` (and `./Freedom.exe`) — Standalone portable Windows executable.
  - `release/Freedom-1.0.0-win.zip` (and `./Freedom-windows-x64.zip`) — Portable Windows archive containing `Freedom.exe` and complete Chromium runtime.
- **Execution on Windows**: Double-click `Freedom.exe`. No installation, Node.js, or external runtimes required.

#### C. Build All Platforms at Once
```bash
npm run build:dist
```

---

### Alternative: Rust/Tauri 2 Pipeline

If you have the native Rust and WebKitGTK/WebView2 toolchains installed:

#### Linux (Tauri)
```bash
bash scripts/build-linux.sh
```

#### Windows (Tauri via PowerShell)
```powershell
.\scripts\build-windows.ps1
```

---

## 6. Privacy & Telemetry Architecture

Freedom has **ZERO remote telemetry by default**:
- No usage statistics, browsing history, URLs, or device IDs are sent to developers or third parties.
- No Google Analytics, no Sentry, no tracking pixels.
- **Telemetry Setting**: Under `Settings -> Telemetry`, a single switch controls `[ OFF ] Local diagnostic logs`.
- When enabled, logs are written strictly to the local device (`~/.config/freedom-browser/diagnostic.log` on Linux or `%APPDATA%\freedom-browser\diagnostic.log` on Windows) and can be cleared or exported by the user at any time.

---

## 7. Performance & Memory Optimization

Low RAM usage is a first-class architectural requirement:
1. **Inactive Tab Hibernation**: When tabs remain inactive beyond the configured threshold (e.g. 15 minutes), Freedom suspends the renderer process to free RAM. The tab remains in the tab bar and restores instantly when clicked.
2. **GPU-Accelerated Starscape**: The Black Space animated star background is rendered on a single HTML5 2D canvas with `requestAnimationFrame`. When the window is hidden, minimized, or viewing media, animation work pauses automatically to prevent CPU/battery drain.
3. **Real-time Task Manager (`Shift+Esc`)**: Exposes real operating system process tree statistics (RAM, CPU, PID, status) via the `sysinfo` crate. Problematic pages can be terminated or suspended individually without crashing other tabs.
4. **Process Isolation**: Every tab runs in an isolated process space provided by the platform engine.

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+T` | Open a new tab |
| `Ctrl+W` | Close the active tab |
| `Ctrl+R` / `F5` | Reload active page |
| `Alt+Left` | Navigate back |
| `Alt+Right` | Navigate forward |
| `Shift+Esc` | Open Freedom Task Manager |
| `Ctrl+J` | Open Downloads drawer |
| `F12` / `Ctrl+Shift+I` | Toggle Developer Tools drawer |
| `Ctrl+,` | Open Settings |

---

## 9. License

Freedom is released under the **MIT License**.
