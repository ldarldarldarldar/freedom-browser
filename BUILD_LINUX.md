# Freedom Browser — building on Linux

Freedom Browser is an Electron application: the browser UI is React + TypeScript (built by Vite into `dist/`),
the main process lives in `electron/`, and every tab is a sandboxed Chromium `<webview>`.
No system web engine, Rust or native toolchain is needed.

## Prerequisites

- Node.js 22 or newer with npm (CachyOS / Arch: `sudo pacman -S --needed nodejs npm`;
  Debian / Ubuntu: Node.js 22 from NodeSource or `nvm`).
- About 1.5 GB of free disk space for `node_modules` and `release/`.

## Build

```bash
npm ci                    # downloads Electron and the build tools
npm run lint              # type check
npm run test:update && npm run test:address && npm run test:downloads && npm run test:net
npm run build:appimage    # release/Freedom-Browser-<version>-x86_64.AppImage
```

The unpacked application is in `release/linux-unpacked/` (`freedom-browser` is the executable).
A `tar.gz` for the release is made from that folder, with a versioned top directory:

```bash
v=<version>
tar -C release --transform "s,^linux-unpacked,Freedom-Browser-$v-linux-x64," \
  -czf "release/Freedom-Browser-$v-linux-x64.tar.gz" linux-unpacked
```

## Run

```bash
chmod +x release/Freedom-Browser-*-x86_64.AppImage
./release/Freedom-Browser-*-x86_64.AppImage
```

Every start of a packaged build registers `~/.local/share/applications/freedom-browser.desktop`
(the "Open with" entry) pointing at the executable that was started. For test runs use a throwaway
`HOME`, `XDG_CONFIG_HOME` and `XDG_DATA_HOME`, so the real launcher and profile stay untouched.

## Windows

`npm run build:win` builds the NSIS installer and the zip. CI (`.github/workflows/release.yml`)
builds and tests them on `windows-latest`, which is the recommended way.
