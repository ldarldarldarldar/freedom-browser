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

> **Freedom Browser 0.6.5-3** — redesigned graphite UI with a new logo, built on **Electron + Chromium**.
>
> ```bash
> npm ci
> npm run build:appimage   # release/Freedom-Browser-0.6.5-3-x86_64.AppImage
> npm run build:win        # release/Freedom-Browser-0.6.5-3-x64-Setup.exe — installer (CI builds it on windows-latest)
> ```
> Design tokens and the redesign notes: [REDESIGN_REPORT.md](REDESIGN_REPORT.md).

---

## 1. Project Overview

Freedom is a desktop browser built on **Electron + Chromium**: the browser UI is a React + TypeScript app,
and every tab is a sandboxed Chromium `<webview>` with its own renderer process. The same build runs on
Windows 10/11 and Linux (Arch, CachyOS, Fedora, Debian/Ubuntu).

Freedom delivers compatibility with modern web standards:
- **HTML5 & CSS3**: Flexbox, CSS Grid, animations, modern viewport units.
- **Modern JavaScript**: ES2024+, async/await, Service Workers, Web Workers.
- **WebAssembly (Wasm)**: Fast client-side computation.
- **WebGL & WebGL2**: GPU-accelerated 3D and 2D canvas rasterization.
- **Hardware Acceleration**: Video decoding, GPU compositing.
- **Storage & Networking**: Cookies, LocalStorage, IndexedDB, WebSockets, HTTPS/TLS 1.3, file uploads and downloads.

---

## 2. Architecture & Directory Structure

```
├── electron/                          # Main process (Node.js side of Electron)
│   ├── main.cjs                       # Windows, tabs, downloads, certificates, IPC handlers
│   ├── preload.cjs                    # The only API the browser UI gets (window.electronAPI)
│   ├── webview-preload.cjs            # Compatibility layer injected into web pages
│   ├── ui-host.cjs                    # Serves the UI from freedom-app://ui/ in its own session
│   ├── adblock.cjs                    # Ghostery ad & tracker blocker
│   ├── extensions.cjs                 # Chrome extensions (folder, .crx, Chrome Web Store)
│   ├── permissions.cjs                # Per-site permission prompts and decisions
│   ├── download-names.cjs             # Safe, non-colliding download file names
│   ├── updater.cjs, update-core.cjs   # Signed self-update (update.json)
│   └── leveldb-reader.cjs             # One-time migration of old file:// localStorage
├── src/                               # Browser UI (React + TypeScript, built by Vite into dist/)
│   ├── browser/                       # Tab types, webview container, load error mapping
│   ├── components/                    # Tab bar, navigation, drawers, settings sections
│   ├── pages/                         # New Tab, Settings, error page, Task Manager, About
│   ├── services/                      # History, bookmarks, sessions, search, IPC bridge
│   ├── settings/                      # Settings schema, defaults, theme presets
│   ├── i18n/                          # English and Russian strings
│   └── App.tsx                        # Main application orchestrator & keyboard shortcuts
├── scripts/                           # Tests and the update manifest signer
├── build/                             # App icons and the NSIS installer script
└── .github/workflows/release.yml      # CI: tests, Linux AppImage, Windows installer + zip
```

---

## 3. Dependencies

### End-User Dependencies (ZERO Runtime Requirements)

The release files carry their own Chromium runtime:
- **Windows**: `Freedom-Browser-<version>-x64-Setup.exe` (installer) or the portable `-x64.zip`.
- **Linux**: `Freedom-Browser-<version>-x86_64.AppImage` or the `linux-x64.tar.gz` archive.
- **Node.js and npm are NOT required** on the user's computer to run Freedom.

### Developer Build-Time Requirements

- **Node.js 22+ & npm** — everything else (Electron, electron-builder, Vite) comes from `npm ci`.
- A Windows installer is best built by CI on `windows-latest` (see `.github/workflows/release.yml`).

---

## 4. Development Commands

```bash
npm ci                 # install dependencies
npm run dev            # UI dev server on http://127.0.0.1:3000
npm run electron:dev   # Electron window that loads the dev server
npm run lint           # type check
npm run test:update && npm run test:address && npm run test:downloads   # logic tests
```

---

## 5. Production Build Commands

```bash
npm run build:appimage   # release/Freedom-Browser-<version>-x86_64.AppImage (+ release/linux-unpacked)
npm run build:win        # release/Freedom-Browser-<version>-x64-Setup.exe and -x64.zip
```

The AppImage is standalone: `chmod +x Freedom-Browser-*.AppImage && ./Freedom-Browser-*.AppImage`.
Releases are built and tested by CI on every `v*` tag.

---

## 6. Privacy & Telemetry Architecture

Freedom has **ZERO remote telemetry by default**:
- No usage statistics, browsing history, URLs, or device IDs are sent to developers or third parties.
- No Google Analytics, no Sentry, no tracking pixels.
- **Update checks**: once per start the browser asks GitHub for the latest release (switch: `Settings -> Privacy`), and Chrome Web Store extensions are checked for updates at Google's update server, as in Chrome. No browsing data is included.
- **Telemetry Setting**: Under `Settings -> Telemetry`, a single switch controls `[ OFF ] Local diagnostic logs`.
- When enabled, logs are written strictly to the local device (`~/.config/freedom-browser/diagnostic.log` on Linux or `%APPDATA%\freedom-browser\diagnostic.log` on Windows) and can be cleared or exported by the user at any time.

---

## 7. Performance & Memory Optimization

Low RAM usage is a first-class architectural requirement:
1. **Inactive Tab Hibernation**: When tabs remain inactive beyond the configured threshold (e.g. 15 minutes), Freedom suspends the renderer process to free RAM. The tab remains in the tab bar and restores instantly when clicked.
2. **GPU-Accelerated Starscape**: The Black Space animated star background is rendered on a single HTML5 2D canvas with `requestAnimationFrame`. When the window is hidden, minimized, or viewing media, animation work pauses automatically to prevent CPU/battery drain.
3. **Real-time Task Manager (`Shift+Esc`)**: Exposes real operating system process tree statistics (RAM, CPU, PID, status) from Chromium's process metrics. Problematic pages can be terminated or suspended individually without crashing other tabs.
4. **Process Isolation**: Every tab runs in its own sandboxed Chromium renderer process (Settings → Browser Mode & RAM can cap the number of page processes).

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
