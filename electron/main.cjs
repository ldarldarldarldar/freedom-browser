const { app, BrowserWindow, ipcMain, shell, session, dialog, Menu, MenuItem, clipboard, webContents, net, protocol } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const url = require('url');
const { execFile } = require('child_process');
const { UI_ORIGIN, UI_PARTITION, registerUiScheme, serveUi, migrateUiStorage } = require('./ui-host.cjs');
const { createAdBlocker, STUB_SCHEME_PRIVILEGES } = require('./adblock.cjs');
const { createPermissionManager, originOf } = require('./permissions.cjs');
const { createUpdater } = require('./updater.cjs');
const downloadNames = require('./download-names.cjs');
const netPrivacy = require('./net-privacy.cjs');

// Must happen before app ready
registerUiScheme(protocol, [STUB_SCHEME_PRIVILEGES]);

// User Data Storage Path & System Configuration
// Separates application binaries (e.g. Program Files\Freedom Browser) from user data (profiles, history, bookmarks, cookies).
// Defaults to user-writable %APPDATA%\Freedom Browser\User Data on Windows or ~/.config/freedom-browser/User Data on Linux.
const storageConfigFile = path.join(app.getPath('appData'), 'Freedom Browser', 'storage-config.json');
const defaultUserDataDir = path.join(app.getPath('appData'), 'Freedom Browser', 'User Data');
let activeUserDataDir = defaultUserDataDir;

function readStorageConfig() {
  try {
    if (fs.existsSync(storageConfigFile)) {
      const raw = fs.readFileSync(storageConfigFile, 'utf8');
      return JSON.parse(raw) || {};
    }
  } catch (err) {
    console.warn('Failed to parse storage-config.json:', err);
  }
  return {};
}

function writeStorageConfig(updates) {
  try {
    const configDir = path.dirname(storageConfigFile);
    fs.mkdirSync(configDir, { recursive: true });
    const current = readStorageConfig();
    const next = { ...current, ...updates, updatedAt: Date.now() };
    fs.writeFileSync(storageConfigFile, JSON.stringify(next, null, 2), 'utf8');
    return next;
  } catch (err) {
    console.warn('Failed to write storage-config.json:', err);
    return null;
  }
}

// Files Chromium keeps only for the running instance; never copied to a new profile folder
const PROFILE_RUNTIME_FILES = new Set(['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'DevToolsActivePort', 'lockfile', 'LOCK']);

const initialStorageConfig = readStorageConfig();
if (initialStorageConfig.userDataPath && typeof initialStorageConfig.userDataPath === 'string') {
  activeUserDataDir = initialStorageConfig.userDataPath;
}

// Data folder change (Settings → Telemetry & Logs) is applied here, before Chromium opens the profile,
// so cookies/history databases are copied while nothing has them open
const pendingMove = initialStorageConfig.pendingUserDataPath;
// Another running instance still uses the old profile: leave the move for a start when it is closed
let oldProfileFree = false;
if (pendingMove && typeof pendingMove === 'string') {
  try {
    app.setPath('userData', activeUserDataDir);
    oldProfileFree = app.requestSingleInstanceLock();
    if (oldProfileFree) app.releaseSingleInstanceLock();
  } catch {}
}
if (oldProfileFree) {
  try {
    fs.mkdirSync(pendingMove, { recursive: true });
    if (initialStorageConfig.pendingMigrate && fs.existsSync(activeUserDataDir)) {
      fs.cpSync(activeUserDataDir, pendingMove, {
        recursive: true,
        force: false,
        errorOnExist: false,
        filter: (src) => !PROFILE_RUNTIME_FILES.has(path.basename(src)),
      });
    }
    activeUserDataDir = pendingMove;
    writeStorageConfig({ userDataPath: pendingMove, pendingUserDataPath: null, pendingMigrate: null, lastMoveError: null });
  } catch (err) {
    console.warn('Failed to move user data, keeping the old folder:', err);
    writeStorageConfig({ pendingUserDataPath: null, pendingMigrate: null, lastMoveError: String(err.message || err) });
  }
}

try {
  fs.mkdirSync(activeUserDataDir, { recursive: true });
  app.setPath('userData', activeUserDataDir);
} catch (err) {
  console.warn('Failed to set custom userData path, falling back:', err);
}

// Hardware Acceleration control: If disabled by user in Settings, disable Chromium GPU process entirely
// This saves ~150-200 MB RAM on low-spec PCs by running rendering purely in CPU mode
const isHardwareAccelerationEnabled = initialStorageConfig.hardwareAcceleration !== false;
if (!isHardwareAccelerationEnabled) {
  app.disableHardwareAcceleration();
}

// 1. Performance & Memory Optimization Command-Line Switches
// Applied before app ready to strip telemetry, background daemons, and reduce process bloat
app.commandLine.appendSwitch('disable-breakpad'); // Disables crash reporter threads & telemetry
app.commandLine.appendSwitch('disable-component-update'); // Prevents background component updater polling
app.commandLine.appendSwitch('disable-domain-reliability'); // Disables diagnostic network tracking
app.commandLine.appendSwitch('disable-sync'); // Disables cloud synchronization services
app.commandLine.appendSwitch('disable-speech-api'); // Disables speech recognition daemon
app.commandLine.appendSwitch('disable-background-networking'); // Eliminates background idle pinging
app.commandLine.appendSwitch('disable-client-side-phishing-detection'); // Disables remote heuristic scraping
app.commandLine.appendSwitch('disable-default-apps');
const disableFeaturesList = process.platform === 'linux'
  ? 'Vulkan,MediaRouter,OptimizationHints,InterestFeedContentSuggestions,Translate,CalculateNativeWinOcclusion'
  : 'MediaRouter,OptimizationHints,InterestFeedContentSuggestions,Translate,CalculateNativeWinOcclusion';
app.commandLine.appendSwitch('disable-features', disableFeaturesList);
app.commandLine.appendSwitch('enable-features', 'V8FlushBaselineCode,V8FlushBytecode,V8MemoryReducer');
// Renderer process limit: Chromium decides by default (every site in its own process, as in Chrome).
// A number can be set in Settings → Performance; read at startup only, so it applies after a restart.
const RENDERER_LIMIT_MIN = 1;
const RENDERER_LIMIT_MAX = 64;
const validRendererLimit = (v) => (Number.isInteger(v) && v >= RENDERER_LIMIT_MIN && v <= RENDERER_LIMIT_MAX ? v : null);
const startupRendererLimit = validRendererLimit(initialStorageConfig.rendererProcessLimit);
if (startupRendererLimit) app.commandLine.appendSwitch('renderer-process-limit', String(startupRendererLimit));
app.commandLine.appendSwitch('disk-cache-size', '67108864'); // 64MB disk cache (keeps working set lean)
// Never add --expose-gc here: it would give every web page a deterministic gc(), a classic exploit primitive
// Blocks third-party cookies inside the network stack, including document.cookie in cross-site iframes.
// Read at startup only, so a change in Settings applies after a restart.
if (initialStorageConfig.blockThirdPartyCookies !== false) {
  app.commandLine.appendSwitch('test-third-party-cookie-phaseout');
}

// GPU optimizations & Linux Wayland/Vulkan conflict fix (saves 60-90 MB GPU process memory)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-vulkan'); // Fixes ozone-platform=wayland Vulkan conflict
  app.commandLine.appendSwitch('disable-vulkan-surface');
}
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// A packaged build never loads its UI from a dev server, whatever the environment or arguments say
const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || process.argv.includes('--dev'));
let mainWindow = null;
let uiSession = null;
let permissionManager = null;
let isForceQuitting = false;
let startupComplete = false;

// Every privileged channel: only the main frame of the browser UI may call it, so a compromised
// tab renderer cannot use IPC to escape its sandbox
function isTrustedUiSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return false;
  if (event.senderFrame !== event.sender.mainFrame) return false;
  const senderUrl = event.senderFrame.url || '';
  return senderUrl.startsWith(`${UI_ORIGIN}/`) || (isDev && senderUrl.startsWith('http://localhost:3000/'));
}
function handleUi(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedUiSender(event)) throw new Error(`Blocked IPC "${channel}" from an untrusted sender`);
    return handler(event, ...args);
  });
}

// ---- Download safety ----
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'msi', 'msix', 'appx', 'bat', 'cmd', 'com', 'scr', 'pif', 'cpl', 'msc', 'lnk', 'url', 'reg', 'hta', 'ps1', 'psm1',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'jar', 'dll', 'iso', 'img', 'vhd', 'vhdx',
  'sh', 'bash', 'zsh', 'fish', 'run', 'bin', 'desktop', 'appimage', 'deb', 'rpm', 'flatpak', 'snap', 'py', 'pl', 'rb',
  'dmg', 'pkg', 'app', 'command',
]);
const isDangerousFile = (name) => DANGEROUS_EXTENSIONS.has(path.extname(String(name)).slice(1).toLowerCase());
const lastInputAt = new WeakMap(); // webContents -> time of the last click or key press in it
const USER_DOWNLOAD_WINDOW_MS = 10000;
const browserDownloads = new Set(); // files saved by this browser during this run
const refusedAutoDownloadSites = new Set();

function hostWindowOf(contents) {
  try {
    const win = BrowserWindow.fromWebContents(contents);
    if (win) return win;
  } catch {}
  return mainWindow;
}

const isUserTriggered = (contents) => Boolean(contents) && Date.now() - (lastInputAt.get(contents) || 0) < USER_DOWNLOAD_WINDOW_MS;
const downloadNeedsApproval = (contents, filename) => isDangerousFile(filename) || !isUserTriggered(contents);

// Resolves true when the download may proceed. Asks for executable types and for downloads the user did not trigger.
async function approveDownload(contents, filename, downloadUrl) {
  const dangerous = isDangerousFile(filename);
  const site = contents && !contents.isDestroyed() ? originOf(contents.getURL()) : '';
  const userTriggered = isUserTriggered(contents);
  if (!dangerous && userTriggered) return true;
  if (!userTriggered && site && refusedAutoDownloadSites.has(site)) return false;
  const ru = currentAppLanguage === 'ru';
  const from = site || originOf(downloadUrl) || downloadUrl;
  const message = ru ? `Скачать файл «${filename}»?` : `Download "${filename}"?`;
  const detail = [
    ru ? `Источник: ${from}` : `From: ${from}`,
    dangerous && (ru ? 'Этот тип файла может запускать программы и навредить компьютеру.' : 'This type of file can run programs and harm your computer.'),
    !userTriggered && (ru ? 'Загрузка началась без вашего действия.' : 'This download started without any action from you.'),
  ].filter(Boolean).join('\n');
  const win = hostWindowOf(contents);
  const options = { type: 'warning', title: 'Freedom Browser', message, detail, buttons: [ru ? 'Отмена' : 'Cancel', ru ? 'Скачать' : 'Download'], defaultId: 0, cancelId: 0, noLink: true };
  const { response } = await (win && !win.isDestroyed() ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options));
  if (response !== 1 && !userTriggered && site) refusedAutoDownloadSites.add(site);
  return response === 1;
}

// Files fetched by the throttled downloader do not pass through Chromium's download code: mark them as
// coming from the internet ourselves, so Windows SmartScreen still checks them
function markFromInternet(filePath, sourceUrl, referrer) {
  if (process.platform !== 'win32') return;
  const lines = ['[ZoneTransfer]', 'ZoneId=3'];
  if (/^https?:/i.test(referrer || '')) lines.push(`ReferrerUrl=${referrer}`);
  if (/^https?:/i.test(sourceUrl || '')) lines.push(`HostUrl=${sourceUrl}`);
  fs.writeFile(`${filePath}:Zone.Identifier`, `${lines.join('\r\n')}\r\n`, () => {});
}
const activeDownloads = new Map();
let activeDownloadsLocation = '';

// ---- Download speed limit (Settings → Main → Download speed limit) ----
// Chromium keeps reading the network while a DownloadItem is paused, so pausing cannot cap
// bandwidth. With a limit set, downloads are fetched by the main process instead (net.request
// on the same session, with its cookies) and piped through a shared token bucket. The stream
// is only read when there is credit, so TCP backpressure slows the server down for real.
let downloadSpeedLimitBps = 0; // 0 = unlimited (native Chromium downloads)
const limiter = { tokens: 0, last: Date.now() };

function takeDownloadCredit(bytes) {
  // Returns ms to wait before `bytes` may be written under the shared limit
  const now = Date.now();
  limiter.tokens = Math.min(limiter.tokens + (downloadSpeedLimitBps * (now - limiter.last)) / 1000, downloadSpeedLimitBps * 0.25);
  limiter.last = now;
  limiter.tokens -= bytes;
  return limiter.tokens >= 0 ? 0 : Math.ceil((-limiter.tokens / downloadSpeedLimitBps) * 1000);
}

function startThrottledDownload({ url, ses, savePath, downloadId, referrer, isPrivate, onEnd }) {
  const startTime = Date.now();
  let received = 0;
  let total = 0;
  let finished = false;
  let lastProgress = 0;
  const send = (channel, extra) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, {
        id: downloadId,
        filename: path.basename(savePath),
        url,
        filepath: savePath,
        isPrivate,
        receivedBytes: received,
        totalBytes: total || received,
        startTime,
        speedBps: Math.round(received / Math.max((Date.now() - startTime) / 1000, 0.001)),
        ...extra,
      });
    }
  };
  const out = fs.createWriteStream(savePath);
  const request = net.request({ url, session: ses, useSessionCookies: true, redirect: 'follow' });
  if (referrer) request.setHeader('Referer', referrer);

  const finish = (state) => {
    if (finished) return;
    finished = true;
    activeDownloads.delete(downloadId);
    out.end(() => {
      if (state !== 'completed') fs.rm(savePath, { force: true }, () => onEnd?.());
      else {
        onEnd?.();
        browserDownloads.add(savePath);
        markFromInternet(savePath, url, referrer);
      }
      send('download-completed', { state, speedBps: 0, totalBytes: state === 'completed' ? received : total || received });
    });
  };

  // Same surface the IPC handlers use for native DownloadItems
  activeDownloads.set(downloadId, {
    cancel: () => { try { request.abort(); } catch {} finish('cancelled'); },
    getReceivedBytes: () => received,
    isDestroyed: () => finished,
  });

  send('download-start', { state: 'progressing', receivedBytes: 0, speedBps: 0 });

  request.on('response', (response) => {
    if (response.statusCode >= 400) {
      finish('interrupted');
      return;
    }
    total = Number(response.headers['content-length']) || 0;
    response.on('data', (chunk) => {
      if (finished) return;
      received += chunk.length;
      const wait = downloadSpeedLimitBps > 0 ? takeDownloadCredit(chunk.length) : 0;
      const canContinue = out.write(chunk);
      if (wait > 0 || !canContinue) {
        response.pause();
        const resume = () => setTimeout(() => !finished && response.resume(), wait);
        if (canContinue) resume(); else out.once('drain', resume);
      }
      if (Date.now() - lastProgress > 400) {
        lastProgress = Date.now();
        send('download-progress', { state: 'progressing' });
      }
    });
    response.on('end', () => finish(total && received < total ? 'interrupted' : 'completed'));
    response.on('error', () => finish('interrupted'));
    response.on('aborted', () => finish('cancelled'));
  });
  request.on('error', () => finish('interrupted'));
  request.end();
}

handleUi('set_download_speed_limit', (event, kbps) => {
  const value = Number(kbps);
  downloadSpeedLimitBps = Number.isFinite(value) && value > 0 ? Math.round(value * 1024) : 0;
  limiter.tokens = 0;
  limiter.last = Date.now();
  return downloadSpeedLimitBps;
});
let currentAppLanguage = 'en';
let pendingOpenUrl = null;

const isPlatformWin = process.platform === 'win32';
const isPlatformMac = process.platform === 'darwin';

// Unified authentic Desktop Chrome User-Agent across all web navigation and authentication flows
const chromeMajor = process.versions.chrome.split('.')[0];
const desktopChromeUA = `Mozilla/5.0 (${isPlatformWin
  ? 'Windows NT 10.0; Win64; x64'
  : isPlatformMac
  ? 'Macintosh; Intel Mac OS X 10_15_7'
  : 'X11; Linux x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;

// Extract local HTML file path or Web URL from CLI arguments (for "Open with" -> Freedom Browser)
function extractFileUrlFromArgs(argv, workingDir = process.cwd()) {
  if (!Array.isArray(argv) || argv.length === 0) return null;

  for (let i = 1; i < argv.length; i++) {
    const rawArg = argv[i];
    if (!rawArg || typeof rawArg !== 'string') continue;

    // Remove wrapping quotes if present
    const trimmed = rawArg.trim().replace(/^["']|["']$/g, '');
    if (!trimmed) continue;

    // Ignore electron flags, chromium switches, dev flags
    if (trimmed.startsWith('--') || trimmed.startsWith('-')) continue;

    // Ignore app entry points, wrappers, and executables
    const baseName = path.basename(trimmed).toLowerCase();
    if (
      trimmed === '.' ||
      baseName === 'main.cjs' ||
      baseName === 'electron' ||
      baseName === 'electron.exe' ||
      baseName === 'freedom' ||
      baseName === 'freedom.exe' ||
      baseName === 'freedom browser' ||
      baseName === 'freedom browser.exe' ||
      baseName === 'freedom-browser' ||
      baseName.endsWith('.appimage') ||
      trimmed.includes('node_modules/electron')
    ) {
      continue;
    }

    // 1. Direct Web/File URLs
    if (
      trimmed.startsWith('file://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('freedom://')
    ) {
      return trimmed;
    }

    // 2. Local File Paths (e.g. /home/.../page.html or C:\...\page.html or ./page.html or sample.html)
    const isWindowsPath = /^[a-zA-Z]:[/\\]/.test(trimmed);
    const isAbsoluteUnix = trimmed.startsWith('/');
    const isRelative = trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('~');
    const isDocFile = /\.(html?|xhtml|shtml|xml|svg|txt|pdf)$/i.test(trimmed);

    if (isWindowsPath) {
      const normalized = trimmed.replace(/\\/g, '/');
      return 'file:///' + encodeURI(normalized);
    }

    if (isAbsoluteUnix || isRelative || isDocFile) {
      try {
        let absPath;
        if (trimmed.startsWith('~')) {
          absPath = path.join(os.homedir(), trimmed.slice(1));
        } else {
          absPath = path.isAbsolute(trimmed) ? trimmed : path.resolve(workingDir, trimmed);
        }
        return url.pathToFileURL(absPath).toString();
      } catch (err) {
        console.warn('Failed to parse file path arg:', trimmed, err);
      }
    }
  }

  return null;
}

// Register desktop file and MIME association in Linux environment so "Open With" / "Открыть с помощью" lists Freedom Browser
function registerLinuxDesktopIntegration() {
  if (process.platform !== 'linux' || !app.isPackaged) return;
  try {
    const homeDir = os.homedir();
    const appsDir = path.join(homeDir, '.local', 'share', 'applications');
    const iconsDir = path.join(homeDir, '.local', 'share', 'icons', 'hicolor', '512x512', 'apps');
    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(iconsDir, { recursive: true });

    const targetExec = process.env.APPIMAGE || process.execPath;

    // Copy icon
    const srcIcon = path.join(__dirname, '../build/icons/512x512.png');
    const destIcon = path.join(iconsDir, 'freedom-browser.png');
    if (fs.existsSync(srcIcon)) {
      try {
        fs.copyFileSync(srcIcon, destIcon);
      } catch {}
    }

    const desktopFile = path.join(appsDir, 'freedom-browser.desktop');
    const desktopContent = `[Desktop Entry]
Name=Freedom Browser
GenericName=Web Browser
Comment=Lightweight, fast, and privacy-focused desktop web browser
Exec="${targetExec.replace(/(["`$\\])/g, '\\\\$1')}" %U
Terminal=false
Type=Application
Icon=freedom-browser
StartupWMClass=freedom-browser
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
Categories=Network;WebBrowser;
`;

    fs.writeFileSync(desktopFile, desktopContent, 'utf8');

    // Lists the browser under "Open with". Becoming the default browser stays the user's decision,
    // so ~/.config/mimeapps.list is not touched.
    execFile('update-desktop-database', [appsDir], () => {});
  } catch (err) {
    console.warn('Failed to register Linux desktop integration:', err);
  }
}

// Single instance enforcement: forward file open requests to existing window
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();

      const targetUrl = extractFileUrlFromArgs(commandLine, workingDirectory);
      if (targetUrl) {
        if (mainWindow.webContents.isLoading()) {
          mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.send('open-external-url', { url: targetUrl });
          });
        } else {
          mainWindow.webContents.send('open-external-url', { url: targetUrl });
        }
      }
    }
  });
}

// Native OS open-file handler (macOS and Linux desktop managers)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  try {
    const fileUrl = url.pathToFileURL(filePath).toString();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('open-external-url', { url: fileUrl });
    } else {
      pendingOpenUrl = fileUrl;
    }
  } catch (err) {
    console.warn('Failed to open file via open-file event:', filePath, err);
  }
});

app.on('open-url', (event, rawUrl) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('open-external-url', { url: rawUrl });
  } else {
    pendingOpenUrl = rawUrl;
  }
});

const MENU_STRINGS = {
  en: {
    openLink: 'Open Link',
    openLinkNewTab: 'Open Link in New Tab',
    openLinkBgTab: 'Open Link in Background Tab',
    copyLinkAddress: 'Copy Link Address',
    openImageNewTab: 'Open Image in New Tab',
    saveImageAs: 'Save Image As...',
    copyImageAddress: 'Copy Image Address',
    copy: 'Copy',
    searchWebFor: 'Search Web for "%s"',
    cut: 'Cut',
    paste: 'Paste',
    selectAll: 'Select All',
    back: 'Back',
    forward: 'Forward',
    reload: 'Reload',
    inspectElement: 'Inspect Element',
    noSpellingSuggestions: 'No spelling suggestions',
    addToDictionary: 'Add to Dictionary',
    pictureInPicture: 'Picture in Picture',
  },
  ru: {
    openLink: 'Открыть ссылку',
    openLinkNewTab: 'Открыть ссылку в новой вкладке',
    openLinkBgTab: 'Открыть ссылку в фоновой вкладке',
    copyLinkAddress: 'Копировать адрес ссылки',
    openImageNewTab: 'Открыть изображение в новой вкладке',
    saveImageAs: 'Сохранить изображение как...',
    copyImageAddress: 'Копировать адрес изображения',
    copy: 'Копировать',
    searchWebFor: 'Искать в Интернете "%s"',
    cut: 'Вырезать',
    paste: 'Вставить',
    selectAll: 'Выбрать все',
    back: 'Назад',
    forward: 'Вперед',
    reload: 'Перезагрузить',
    inspectElement: 'Исследовать элемент',
    noSpellingSuggestions: 'Нет вариантов исправления',
    addToDictionary: 'Добавить в словарь',
    pictureInPicture: 'Картинка в картинке',
  },
};

// Paths held by downloads that have not ended yet (including ones waiting for approval as ".pending"),
// so two downloads of the same name started together never get the same file
const reservedDownloadPaths = new Set();

// Safe, non-colliding path in the destination folder, reserved until releaseDownloadPath
function reserveDownloadPath(dir, originalFilename) {
  const target = downloadNames.getUniqueFilePath(dir, originalFilename, { reserved: reservedDownloadPaths });
  reservedDownloadPaths.add(target);
  return target;
}
const releaseDownloadPath = (target) => reservedDownloadPaths.delete(target);

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../build/icons/icon.ico')
    : path.join(__dirname, '../build/icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: '#0c0e10',
    title: 'Freedom Browser',
    icon: iconPath,
    frame: false, // Completely eliminates OS title bar and native borders (Frameless window)
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      session: uiSession,
      preload: path.join(__dirname, 'preload.cjs'),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false, // Disables background spellcheck memory footprint
      sandbox: true,
      additionalArguments: [`--freedom-home-dir=${encodeURIComponent(os.homedir())}`],
    },
  });

  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized-change', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-maximized-change', false);
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-fullscreen-change', true);
    }
  });

  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-fullscreen-change', false);
    }
  });

  mainWindow.on('close', (event) => {
    if (!isForceQuitting) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-app-close');
      }
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        const next = !mainWindow.isFullScreen();
        mainWindow.setFullScreen(next);
      }
      return;
    }
    if (input.key === 'Escape' && mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()) {
      event.preventDefault();
      mainWindow.setFullScreen(false);
      return;
    }
  });

  const fileOrUrlArg = pendingOpenUrl || extractFileUrlFromArgs(process.argv);
  const tabsCountArg = process.argv.find((a) => a.startsWith('--tabs='));
  const query = {};
  if (fileOrUrlArg) query.openUrl = fileOrUrlArg;
  if (tabsCountArg) query.tabCount = tabsCountArg.split('=')[1];
  pendingOpenUrl = null;

  if (isDev) {
    const devUrl = new URL('http://localhost:3000');
    if (query.openUrl) devUrl.searchParams.set('openUrl', query.openUrl);
    if (query.tabCount) devUrl.searchParams.set('tabCount', query.tabCount);
    mainWindow.loadURL(devUrl.toString());
  } else {
    const uiUrl = new URL(`${UI_ORIGIN}/index.html`);
    for (const [key, value] of Object.entries(query)) uiUrl.searchParams.set(key, value);
    mainWindow.loadURL(uiUrl.toString());
  }

  // CI smoke test (`--smoke-test`): verify the renderer UI mounted, then exit with a status code
  if (process.argv.includes('--smoke-test')) {
    const finish = (ok, info) => {
      console.log(`[smoke-test] ${ok ? 'PASS' : 'FAIL'} ${info || ''}`);
      app.exit(ok ? 0 : 1);
    };
    const timer = setTimeout(() => finish(false, 'timeout'), 45000);
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const result = await mainWindow.webContents.executeJavaScript(
            "JSON.stringify({ title: document.title, sidebar: !!document.getElementById('browser-sidebar'), omnibox: !!document.getElementById('browser-omnibar-input') })"
          );
          const parsed = JSON.parse(result);
          clearTimeout(timer);
          finish(parsed.sidebar && parsed.omnibox, result);
        } catch (err) {
          clearTimeout(timer);
          finish(false, String(err));
        }
      }, 3000);
    });
  }

  // The browser UI (it has the privileged preload) never leaves its own page: web links go to tabs
  const appPage = (u) => { try { const x = new URL(u); return x.protocol + x.host + x.pathname; } catch { return ''; } };
  mainWindow.webContents.on('will-navigate', (navEvent, targetUrl) => {
    if (appPage(targetUrl) !== appPage(mainWindow.webContents.getURL())) navEvent.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (/^https?:\/\//.test(targetUrl)) mainWindow?.webContents.send('webview-open-tab', { url: targetUrl });
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Downloads handling: Real downloads to disk with true progress & metrics
  session.defaultSession.on('will-download', (event, item, webContents) => {
    let downloadDir = activeDownloadsLocation;
    if (downloadDir && downloadDir.startsWith('~/')) {
      downloadDir = path.join(os.homedir(), downloadDir.slice(2));
    }
    if (!downloadDir || !fs.existsSync(downloadDir)) {
      downloadDir = app.getPath('downloads');
    }
    if (!fs.existsSync(downloadDir)) {
      try {
        fs.mkdirSync(downloadDir, { recursive: true });
      } catch (err) {
        console.warn('Failed to create downloads dir:', err);
      }
    }

    const originalFilename = item.getFilename() || 'download';
    const finalDownloadPath = reserveDownloadPath(downloadDir, originalFilename);

    const downloadId = 'dl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    const isPrivate = Boolean(webContents && !webContents.isDestroyed() && webContents.session !== session.defaultSession);
    const shownName = path.basename(finalDownloadPath);
    // Speed limit active: hand plain http(s) downloads to the throttled downloader
    const itemUrl = item.getURL();
    if (downloadSpeedLimitBps > 0 && /^https?:/i.test(itemUrl)) {
      event.preventDefault();
      const ses = webContents?.session || session.defaultSession;
      const referrer = webContents && !webContents.isDestroyed() ? webContents.getURL() : '';
      approveDownload(webContents, shownName, itemUrl).then((approved) => {
        if (approved) startThrottledDownload({ url: itemUrl, ses, savePath: finalDownloadPath, downloadId, referrer, isPrivate, onEnd: () => releaseDownloadPath(finalDownloadPath) });
        else releaseDownloadPath(finalDownloadPath);
      }, () => releaseDownloadPath(finalDownloadPath));
      return;
    }

    // Until the user answers, data goes to a name that cannot be run; small files may finish before the answer
    const needsApproval = downloadNeedsApproval(webContents, shownName);
    const pendingPath = needsApproval ? `${finalDownloadPath}.pending` : finalDownloadPath;
    item.setSavePath(pendingPath);
    if (needsApproval) item.pause();
    activeDownloads.set(downloadId, item);

    const startTime = Date.now();
    const downloadUrl = item.getURL();
    const totalBytes = item.getTotalBytes() || 0;

    let approved = !needsApproval;
    let finished = null; // state from the 'done' event

    const announceStart = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-start', {
          id: downloadId,
          filename: shownName,
          url: downloadUrl,
          filepath: finalDownloadPath,
          isPrivate,
          totalBytes,
          receivedBytes: 0,
          state: 'progressing',
          startTime,
          speedBps: 0,
        });
      }
    };

    const reportDone = () => {
      activeDownloads.delete(downloadId);
      releaseDownloadPath(finalDownloadPath);
      const isCompleted = finished === 'completed' && fs.existsSync(finalDownloadPath);
      const finalState = isCompleted ? 'completed' : (finished === 'cancelled' ? 'cancelled' : 'interrupted');
      if (isCompleted) browserDownloads.add(finalDownloadPath);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-completed', {
          id: downloadId,
          filename: shownName,
          url: downloadUrl,
          filepath: finalDownloadPath,
          isPrivate,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes() || item.getReceivedBytes(),
          state: finalState,
          startTime,
          speedBps: 0,
        });
      }
    };

    // Runs once the download has ended and, if it needed approval, the user has allowed it
    const settle = () => {
      if (!approved || finished === null) return;
      if (needsApproval && finished === 'completed') {
        fs.rename(pendingPath, finalDownloadPath, (err) => {
          if (err) {
            console.warn('Failed to finish download:', err);
            finished = 'interrupted';
          }
          reportDone();
        });
      } else {
        reportDone();
      }
    };

    if (needsApproval) {
      const refuse = () => {
        activeDownloads.delete(downloadId);
        try { item.cancel(); } catch {}
        fs.rm(pendingPath, { force: true }, () => releaseDownloadPath(finalDownloadPath));
      };
      approveDownload(webContents, shownName, downloadUrl).then((allowed) => {
        if (!allowed) return refuse();
        approved = true;
        announceStart();
        if (item.getState() === 'progressing') item.resume();
        settle();
      }, refuse);
    } else {
      announceStart();
    }

    item.on('updated', (evt, state) => {
      if (approved && mainWindow && !mainWindow.isDestroyed()) {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes() || totalBytes;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speed = elapsedSec > 0 ? Math.round(received / elapsedSec) : 0;

        mainWindow.webContents.send('download-progress', {
          id: downloadId,
          filename: path.basename(finalDownloadPath),
          url: downloadUrl,
          filepath: finalDownloadPath,
          isPrivate,
          receivedBytes: received,
          totalBytes: total,
          state: state === 'progressing' ? 'progressing' : 'paused',
          startTime,
          speedBps: speed,
        });
      }
    });

    item.once('done', (evt, state) => {
      finished = state;
      // Ended while the dialog was open and the user refused: refuse() already removed it
      settle();
    });
  });
}

// Pages may only open web URLs in new tabs; file:// only from local files (never internal or script URLs)
function isWebTabUrl(targetUrl, opener) {
  try {
    const { protocol } = new URL(targetUrl);
    if (protocol === 'http:' || protocol === 'https:') return true;
    if (protocol === 'file:') return (opener?.getURL() || '').startsWith('file:');
  } catch {}
  return false;
}

// target=_blank, Ctrl/middle click and window.open from tab pages and their popups
function routeNewWindows(pageContents) {
  // Popup blocker: like Chrome, a page may only open tabs/windows right after the user clicked or
  // pressed a key in it (input-event also covers iframes, e.g. "Sign in with Google" buttons)
  let lastUserInput = 0;
  pageContents.on('input-event', (inputEvent, input) => {
    if (/^(mouseDown|mouseUp|keyDown|rawKeyDown|touchStart|touchEnd|gestureTap)$/.test(input.type)) {
      lastUserInput = Date.now();
      lastInputAt.set(pageContents, lastUserInput);
    }
  });

  // Links that ask for a new tab/window (target=_blank, Ctrl/middle click, window.open).
  // Electron would otherwise open them in a bare BrowserWindow.
  pageContents.setWindowOpenHandler(({ url: targetUrl, disposition }) => {
    if (!isWebTabUrl(targetUrl, pageContents)) return { action: 'deny' };
    if (privacyState.popupsBlocked && Date.now() - lastUserInput > 1500) return { action: 'deny' };
    if (disposition === 'save-to-disk') {
      pageContents.downloadURL(targetUrl);
      return { action: 'deny' };
    }
    // Shift+click / window.open with size features: a real popup, so sign-in flows keep window.opener
    if (disposition === 'new-window') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: '#16191c',
          webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, nodeIntegrationInSubFrames: true, preload: path.join(__dirname, 'webview-preload.cjs') },
        },
      };
    }
    // Ctrl+click and middle click open in the background (Ctrl+Shift+click in the foreground)
    mainWindow?.webContents.send('webview-open-tab', {
      url: targetUrl,
      active: disposition !== 'background-tab',
      isPrivate: pageContents.session !== session.defaultSession,
    });
    return { action: 'deny' };
  });
  pageContents.on('did-create-window', (popup) => {
    routeNewWindows(popup.webContents);
    // A popup has no address bar: its title always shows the real site, whatever the page calls itself
    const showSite = () => {
      if (!popup.isDestroyed()) popup.setTitle(originOf(popup.webContents.getURL()) || 'Freedom Browser');
    };
    popup.on('page-title-updated', (titleEvent) => { titleEvent.preventDefault(); showSite(); });
    popup.webContents.on('did-navigate', showSite);
    popup.webContents.on('did-navigate-in-page', showSite);
    showSite();
  });
}

// ---- Certificate errors ----
// Chromium rejects a bad certificate by default; the tab then shows the "connection is not private" page.
// "Proceed anyway" adds an exception for one host and one certificate (fingerprint) in one tab only.
// It lives in memory and goes away when the tab (and with it a private session's tab) is closed.
const certExceptions = new Map(); // webContents id -> Set of `${host}|${fingerprint}`
const lastCertErrors = new Map(); // webContents id -> details of the last main-frame certificate error
const CERT_ERROR_TTL_MS = 30 * 60 * 1000;
const hostOf = (u) => { try { return new URL(u).host.toLowerCase(); } catch { return ''; } };

function forgetCertState(id) {
  certExceptions.delete(id);
  lastCertErrors.delete(id);
}

app.on('certificate-error', (event, contents, requestUrl, error, certificate, callback, isMainFrame) => {
  const host = hostOf(requestUrl);
  const fingerprint = certificate?.fingerprint || '';
  const isTab = Boolean(contents) && !contents.isDestroyed() && contents.getType() === 'webview';
  // Subresources and iframes are always refused, and only web tabs can ever get an exception
  if (!isTab || !isMainFrame || !host || !fingerprint) return callback(false);
  if (certExceptions.get(contents.id)?.has(`${host}|${fingerprint}`)) {
    event.preventDefault();
    return callback(true);
  }
  if (!lastCertErrors.has(contents.id) && !certExceptions.has(contents.id)) {
    contents.once('destroyed', () => forgetCertState(contents.id));
  }
  lastCertErrors.set(contents.id, {
    url: requestUrl,
    host,
    fingerprint,
    error: String(error || ''),
    subjectName: certificate.subjectName || '',
    issuerName: certificate.issuerName || '',
    validStart: certificate.validStart || 0,
    validExpiry: certificate.validExpiry || 0,
    at: Date.now(),
  });
  callback(false);
});

// What the error page shows about the certificate of this tab's last failed load
handleUi('cert_error_info', (event, webContentsId, pageUrl) => {
  const info = lastCertErrors.get(Number(webContentsId));
  if (!info || info.host !== hostOf(pageUrl) || Date.now() - info.at > CERT_ERROR_TTL_MS) return null;
  const { fingerprint, at, ...shown } = info;
  return shown;
});

// "Proceed anyway (unsafe)": trusts exactly the certificate this tab was shown for this host
handleUi('cert_allow', (event, webContentsId, pageUrl) => {
  const id = Number(webContentsId);
  const target = webContents.fromId(id);
  const info = lastCertErrors.get(id);
  if (!target || target.isDestroyed() || target.getType() !== 'webview') return false;
  if (!info || info.host !== hostOf(pageUrl) || Date.now() - info.at > CERT_ERROR_TTL_MS) return false;
  if (!certExceptions.has(id)) certExceptions.set(id, new Set());
  certExceptions.get(id).add(`${info.host}|${info.fingerprint}`);
  return true;
});

// Webview contents creation & security
app.on('web-contents-created', (event, contents) => {
  // Pages see only the public address, never LAN addresses of the machine (also after camera/microphone access)
  contents.setWebRTCIPHandlingPolicy('default_public_interface_only');

  if (contents.getType() === 'window') {
    // Every <webview> gets the hardened preferences and our preload, whatever the renderer asked for
    contents.on('will-attach-webview', (attachEvent, webPreferences, params) => {
      delete webPreferences.preloadURL;
      webPreferences.preload = path.join(__dirname, 'webview-preload.cjs');
      webPreferences.nodeIntegration = false;
      // With the sandbox on this gives no Node: it only runs our preload in iframes too (see its compatibility part)
      webPreferences.nodeIntegrationInSubFrames = true;
      webPreferences.contextIsolation = true;
      webPreferences.webSecurity = true;
      webPreferences.sandbox = true;
      webPreferences.webviewTag = false;
      webPreferences.allowRunningInsecureContent = false;
      // Chromium's built-in PDF viewer: without plugins a PDF link was only downloaded
      webPreferences.plugins = true;
      webPreferences.spellcheck = true;
      // A guest is transparent by default: an unstyled page would put black text on the dark browser window.
      // Opaque, it gets the canvas of its own color scheme: white, or dark for pages that ask for dark.
      webPreferences.transparent = false;
      delete webPreferences.enableBlinkFeatures;
      delete webPreferences.disableBlinkFeatures;
      // Tabs use the default profile or an in-memory incognito partition, never the UI's own session
      const partitionOk = !params.partition || /^freedom-incognito-[a-z0-9]+$/.test(params.partition);
      if (!partitionOk || !/^((https?|file):|about:blank$)/.test(params.src || '')) attachEvent.preventDefault();
    });
  }

  if (contents.getType() === 'webview') {
    configureBrowsingSession(contents.session);
    contents.setBackgroundThrottling(true);

    // Speaker icon on the tab (src/components/TabBar.tsx): the renderer matches the id to its <webview>
    contents.on('audio-state-changed', ({ audible }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-audio-state', { webContentsId: contents.id, audible: Boolean(audible) });
      }
    });

    routeNewWindows(contents);


    // Handle HTML5 Fullscreen API requests from games or video players inside webviews
    contents.on('enter-html-full-screen', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(true);
        mainWindow.webContents.send('window-fullscreen-change', true);
        // A full-screen page can draw a fake browser: always say which site it is and how to leave
        mainWindow.webContents.send('webview-html-fullscreen', { site: originOf(contents.getURL()) });
      }
    });

    contents.on('leave-html-full-screen', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setFullScreen(false);
        mainWindow.webContents.send('window-fullscreen-change', false);
      }
    });

    // Intercept keyboard shortcuts inside webview before page can swallow them
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;

      // Fullscreen Toggle (F11 / Escape)
      if (input.key === 'F11') {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          const next = !mainWindow.isFullScreen();
          mainWindow.setFullScreen(next);
        }
        return;
      }

      if (input.key === 'Escape') {
        if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isFullScreen()) {
          event.preventDefault();
          mainWindow.setFullScreen(false);
          return;
        }
      }

      const isCtrl = process.platform === 'darwin' ? input.meta : input.control;
      if (!isCtrl) return;

      // Zoom In: Ctrl + + / Ctrl + = / NumpadAdd
      if (
        input.key === '+' ||
        input.key === '=' ||
        input.key === 'Add' ||
        input.code === 'Equal' ||
        input.code === 'NumpadAdd'
      ) {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('webview-zoom-in');
        }
        return;
      }

      // Zoom Out: Ctrl + - / Ctrl + _ / NumpadSubtract
      if (
        input.key === '-' ||
        input.key === '_' ||
        input.key === 'Subtract' ||
        input.code === 'Minus' ||
        input.code === 'NumpadSubtract'
      ) {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('webview-zoom-out');
        }
        return;
      }

      // Zoom Reset: Ctrl + 0 / Numpad0
      if (input.key === '0' || input.code === 'Digit0' || input.code === 'Numpad0') {
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('webview-zoom-reset');
        }
        return;
      }

      // Essential browser navigation shortcuts forwarded to main window
      if (keyIs(input, 't') && !input.shift) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'new-tab');
        return;
      }
      if (keyIs(input, 'n') && input.shift) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'new-private-tab');
        return;
      }
      if (keyIs(input, 'w')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'close-tab');
        return;
      }
      if (keyIs(input, 't') && input.shift) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'restore-tab');
        return;
      }
      if (keyIs(input, 'l')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'focus-url');
        return;
      }
      if (keyIs(input, 'f')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'find-in-page');
        return;
      }
      if (keyIs(input, 'h')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'open-history');
        return;
      }
      if (keyIs(input, 'd')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'toggle-bookmark');
        return;
      }
      if (keyIs(input, 'j')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'open-downloads');
        return;
      }
      if (keyIs(input, 'o')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'open-file');
        return;
      }
      if (keyIs(input, 'r')) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', input.shift ? 'hard-reload' : 'reload');
        return;
      }
    });

    // Native Browser Context Menu for Web Content
    contents.on('context-menu', (event, params) => {
      event.preventDefault();
      const menu = new Menu();
      const i18n = MENU_STRINGS[currentAppLanguage] || MENU_STRINGS.en;
      // Same rule as links opened by the page itself: no file://, javascript: or internal URLs from web pages.
      // Tabs opened from an incognito tab stay incognito.
      const isPrivate = contents.session !== session.defaultSession;
      const canOpen = (target) => isWebTabUrl(target, contents);

      // 0. Spelling: suggestions for the word under the cursor (Settings → Main → Spell check)
      if (params.isEditable && params.misspelledWord) {
        const suggestions = (params.dictionarySuggestions || []).slice(0, 6);
        for (const word of suggestions) {
          menu.append(new MenuItem({ label: word, click: () => contents.replaceMisspelling(word) }));
        }
        if (suggestions.length === 0) menu.append(new MenuItem({ label: i18n.noSpellingSuggestions, enabled: false }));
        menu.append(new MenuItem({ type: 'separator' }));
        menu.append(new MenuItem({
          label: i18n.addToDictionary,
          click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 1. Link Actions
      if (params.linkURL) {
        if (canOpen(params.linkURL)) {
          menu.append(new MenuItem({
            label: i18n.openLink,
            click: () => { contents.loadURL(params.linkURL); },
          }));
          menu.append(new MenuItem({
            label: i18n.openLinkNewTab,
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('webview-open-tab', { url: params.linkURL, active: true, isPrivate });
              }
            },
          }));
          menu.append(new MenuItem({
            label: i18n.openLinkBgTab,
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('webview-open-tab', { url: params.linkURL, active: false, isPrivate });
              }
            },
          }));
        }
        menu.append(new MenuItem({
          label: i18n.copyLinkAddress,
          click: () => { clipboard.writeText(params.linkURL); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 2. Image Actions
      if (params.mediaType === 'image' && params.srcURL) {
        if (canOpen(params.srcURL)) {
          menu.append(new MenuItem({
            label: i18n.openImageNewTab,
            click: () => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('webview-open-tab', { url: params.srcURL, active: true, isPrivate });
              }
            },
          }));
        }
        menu.append(new MenuItem({
          label: i18n.saveImageAs,
          click: () => {
            lastInputAt.set(contents, Date.now());
            contents.downloadURL(params.srcURL);
          },
        }));
        menu.append(new MenuItem({
          label: i18n.copyImageAddress,
          click: () => { clipboard.writeText(params.srcURL); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 2b. Video: picture in picture (also in the tab's own menu, for players that hide this menu)
      if (params.mediaType === 'video') {
        menu.append(new MenuItem({
          label: i18n.pictureInPicture,
          click: () => { togglePictureInPicture(contents, params.frame).catch(() => {}); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 3. Text Selection Actions
      if (params.selectionText && params.selectionText.trim().length > 0) {
        const text = params.selectionText.trim();
        // In a text field the editing block below has its own Copy
        if (!params.isEditable) {
          menu.append(new MenuItem({
            label: i18n.copy,
            role: 'copy',
          }));
        }
        const truncated = text.length > 25 ? text.substring(0, 25) + '...' : text;
        menu.append(new MenuItem({
          label: i18n.searchWebFor.replace('%s', truncated),
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-search-text', { text, isPrivate });
            }
          },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 4. Editable Inputs
      if (params.isEditable) {
        menu.append(new MenuItem({ label: i18n.cut, role: 'cut', enabled: params.editFlags.canCut }));
        menu.append(new MenuItem({ label: i18n.copy, role: 'copy', enabled: params.editFlags.canCopy }));
        menu.append(new MenuItem({ label: i18n.paste, role: 'paste', enabled: params.editFlags.canPaste }));
        menu.append(new MenuItem({ label: i18n.selectAll, role: 'selectAll' }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 5. Page Navigation Actions
      menu.append(new MenuItem({
        label: i18n.back,
        enabled: contents.canGoBack(),
        click: () => { contents.goBack(); },
      }));
      menu.append(new MenuItem({
        label: i18n.forward,
        enabled: contents.canGoForward(),
        click: () => { contents.goForward(); },
      }));
      menu.append(new MenuItem({
        label: i18n.reload,
        accelerator: 'CmdOrCtrl+R',
        click: () => { contents.reload(); },
      }));

      // 6. Developer Tools / Inspect Element
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({
        label: i18n.inspectElement,
        click: () => {
          contents.inspectElement(params.x, params.y);
          if (!contents.isDevToolsOpened?.()) {
            contents.openDevTools({ mode: 'detach' });
          }
        },
      }));

      menu.popup({ window: mainWindow });
    });
  }
});

// Helper: Read Linux /proc/[pid]/smaps_rollup to get 100% accurate PSS and Private Memory
function getLinuxProcessMemory(pid) {
  try {
    const smaps = fs.readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
    const pssMatch = smaps.match(/Pss:\s+(\d+)\s+kB/);
    const rssMatch = smaps.match(/Rss:\s+(\d+)\s+kB/);
    const privCleanMatch = smaps.match(/Private_Clean:\s+(\d+)\s+kB/);
    const privDirtyMatch = smaps.match(/Private_Dirty:\s+(\d+)\s+kB/);

    const pssKb = pssMatch ? parseInt(pssMatch[1], 10) : 0;
    const rssKb = rssMatch ? parseInt(rssMatch[1], 10) : 0;
    const privateKb = (privCleanMatch ? parseInt(privCleanMatch[1], 10) : 0) +
                      (privDirtyMatch ? parseInt(privDirtyMatch[1], 10) : 0);

    return {
      pssBytes: pssKb * 1024,
      rssBytes: rssKb * 1024,
      privateBytes: privateKb * 1024,
    };
  } catch {
    // smaps_rollup not available or permission denied: fallback to /proc/[pid]/status
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
      const rssMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
      const rssKb = rssMatch ? parseInt(rssMatch[1], 10) : 0;
      return {
        pssBytes: rssKb * 1024,
        rssBytes: rssKb * 1024,
        privateBytes: Math.round(rssKb * 0.6) * 1024,
      };
    } catch {
      return null;
    }
  }
}

function getLinuxSystemMemory() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const getVal = (key) => {
      const m = meminfo.match(new RegExp(`${key}:\\s+(\\d+)\\s+kB`));
      return m ? parseInt(m[1], 10) * 1024 : 0;
    };
    const memAvailable = getVal('MemAvailable') || getVal('MemFree');
    const swapTotal = getVal('SwapTotal');
    const swapFree = getVal('SwapFree');
    const swapUsed = Math.max(0, swapTotal - swapFree);
    return { memAvailable, swapTotal, swapUsed };
  } catch {
    return null;
  }
}

// Real Non-Duplicating System Task Manager Resource Monitor
handleUi('get_system_task_manager_stats', async () => {
  try {
    const metrics = app.getAppMetrics();
    const cpuUsage = process.getCPUUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const isLinux = process.platform === 'linux';

    let totalNonDuplicatedRam = 0;
    let totalPrivateRam = 0;
    let totalWorkingSetRam = 0;

    let availableSystemRam = freeMem;
    let totalSwap = 0;
    let usedSwap = 0;
    if (isLinux) {
      const sysMem = getLinuxSystemMemory();
      if (sysMem) {
        availableSystemRam = sysMem.memAvailable;
        totalSwap = sysMem.swapTotal;
        usedSwap = sysMem.swapUsed;
      }
    }
    const pressurePercent = Math.min(100, Math.round(((totalMem - availableSystemRam) / totalMem) * 100));
    const pressureLevel = pressurePercent >= 85 ? 'critical' : pressurePercent >= 70 ? 'moderate' : 'normal';

    const processes = metrics.map((m) => {
      let procTitle = 'Freedom Browser Core';
      let procType = 'browser-core';
      let canTerminate = false;
      let canSuspend = false;

      if (m.type === 'Tab') {
        procTitle = `Web Tab (PID: ${m.pid})`;
        procType = 'renderer-tab';
        canTerminate = true;
        canSuspend = true;
      } else if (m.type === 'GPU') {
        procTitle = 'GPU Compositor';
        procType = 'gpu-compositor';
      } else if (m.type === 'Utility') {
        procTitle = 'Network & Utility Service';
        procType = 'network-service';
      } else if (m.type === 'Zygote') {
        procTitle = 'Process Sandbox Host';
        procType = 'browser-core';
      }

      let ramBytes = 0;
      let privateBytes = 0;
      let workingSetBytes = (m.memory?.workingSetSize || 0) * 1024;

      if (isLinux) {
        const linuxMem = getLinuxProcessMemory(m.pid);
        if (linuxMem) {
          ramBytes = linuxMem.pssBytes; // PSS is real non-duplicated RAM
          privateBytes = linuxMem.privateBytes;
          workingSetBytes = linuxMem.rssBytes;
        } else {
          privateBytes = (m.memory?.privateBytes || (m.memory?.workingSetSize * 0.5) || 0) * 1024;
          ramBytes = privateBytes;
        }
      } else {
        // Windows: use privateBytes directly to avoid double counting shared memory
        privateBytes = (m.memory?.privateBytes || 0) * 1024;
        ramBytes = privateBytes > 0 ? privateBytes : Math.round(workingSetBytes * 0.6);
      }

      totalNonDuplicatedRam += ramBytes;
      totalPrivateRam += privateBytes;
      totalWorkingSetRam += workingSetBytes;

      return {
        id: `proc-${m.pid}`,
        pid: m.pid,
        title: procTitle,
        processType: procType,
        ramUsageBytes: ramBytes,
        ramUsageMb: Math.round(ramBytes / (1024 * 1024)),
        privateBytes: privateBytes,
        privateMb: Math.round(privateBytes / (1024 * 1024)),
        workingSetBytes: workingSetBytes,
        workingSetMb: Math.round(workingSetBytes / (1024 * 1024)),
        cpuUsagePercent: Math.round((m.cpu?.percentCPUUsage || 0) * 10) / 10,
        networkSpeedKbps: 0.0,
        status: 'active',
        isForeground: m.type === 'Browser',
        canTerminate,
        canSuspend,
        tabsCount: m.type === 'Tab' ? 1 : undefined,
      };
    });

    const openTabsCount = metrics.filter((m) => m.type === 'Tab').length;

    return {
      stats: {
        totalBrowserRamBytes: totalNonDuplicatedRam,
        totalBrowserRamMb: Math.round(totalNonDuplicatedRam / (1024 * 1024)),
        browserRamMb: Math.round(totalNonDuplicatedRam / (1024 * 1024)),
        privateRamMb: Math.round(totalPrivateRam / (1024 * 1024)),
        workingSetMb: Math.round(totalWorkingSetRam / (1024 * 1024)),
        totalSystemRamBytes: totalMem,
        totalSystemRamMb: Math.round(totalMem / (1024 * 1024)),
        systemRamMb: Math.round(totalMem / (1024 * 1024)),
        availableSystemRamBytes: availableSystemRam,
        availableSystemRamMb: Math.round(availableSystemRam / (1024 * 1024)),
        totalSwapBytes: totalSwap,
        usedSwapBytes: usedSwap,
        memoryPressurePercent: pressurePercent,
        memoryPressureLevel: pressureLevel,
        systemRamPercent: Math.min(100, Math.round((usedMem / totalMem) * 100)),
        totalBrowserCpuPercent: Math.round((cpuUsage.percentCPUUsage || 0) * 10) / 10,
        totalSystemCpuPercent: Math.min(100, Math.round(metrics.reduce((acc, m) => acc + (m.cpu?.percentCPUUsage || 0), 0))),
        openTabsCount: Math.max(1, openTabsCount),
        activeProcessesCount: processes.length,
        networkUpKbps: 0,
        networkDownKbps: 0,
        platform: isLinux ? 'linux' : process.platform === 'win32' ? 'windows' : 'macos',
        engineName: 'Chromium',
        measurementMethod: isLinux ? 'Linux /proc PSS (Proportional Set Size)' : 'Windows Private Working Set',
      },
      processes,
    };
  } catch (err) {
    console.error('Failed to get real metrics:', err);
    return null;
  }
});

// Real per-tab webview memory usage without duplication
handleUi('get_webviews_memory', async (event, mappings) => {
  const result = {};
  if (!Array.isArray(mappings)) return result;

  try {
    const metrics = app.getAppMetrics();
    const metricsByPid = new Map();
    for (const m of metrics) {
      metricsByPid.set(m.pid, m);
    }
    const isLinux = process.platform === 'linux';

    for (const item of mappings) {
      if (!item || !item.tabId) continue;
      let ramBytes = 0;
      if (item.webContentsId) {
        try {
          const wc = webContents.fromId(item.webContentsId);
          if (wc && !wc.isDestroyed()) {
            const pid = wc.getOSProcessId();
            if (pid) {
              if (isLinux) {
                const linuxMem = getLinuxProcessMemory(pid);
                if (linuxMem) {
                  ramBytes = linuxMem.pssBytes;
                } else {
                  const m = metricsByPid.get(pid);
                  ramBytes = (m?.memory?.privateBytes || (m?.memory?.workingSetSize ? m.memory.workingSetSize * 512 : 0)) * 1024;
                }
              } else {
                const m = metricsByPid.get(pid);
                if (m) {
                  const privateBytes = (m.memory?.privateBytes || 0) * 1024;
                  const workingSetBytes = (m.memory?.workingSetSize || 0) * 1024;
                  ramBytes = privateBytes > 0 ? privateBytes : Math.round(workingSetBytes * 0.6);
                }
              }
            }
          }
        } catch (e) {
          // ignore error for destroyed webcontents
        }
      }
      result[item.tabId] = ramBytes;
    }
  } catch (err) {
    console.warn('Error fetching webviews memory:', err);
  }

  return result;
});

// Terminate process safely
handleUi('terminate_process', (event, pid) => {
  try {
    // Only renderer processes of this browser's tabs, never an arbitrary PID
    if (!app.getAppMetrics().some((m) => m.pid === pid && m.type === 'Tab')) return false;
    process.kill(pid);
    return true;
  } catch (err) {
    console.warn(`Failed to terminate PID ${pid}:`, err);
    return false;
  }
});

// Freedom RAM Control (FRC) - Manual memory reclamation / clean RAM
handleUi('clean_ram', async () => {
  try {
    const isLinux = process.platform === 'linux';
    const beforeMetrics = app.getAppMetrics();
    let beforeBytes = 0;
    for (const m of beforeMetrics) {
      if (isLinux) {
        const mem = getLinuxProcessMemory(m.pid);
        beforeBytes += mem ? mem.pssBytes : ((m.memory?.workingSetSize || 0) * 1024);
      } else {
        const priv = (m.memory?.privateBytes || 0) * 1024;
        beforeBytes += priv > 0 ? priv : ((m.memory?.workingSetSize || 0) * 1024);
      }
    }

    // No forced V8 gc here: measured in 0.6.5-2, it freed 1-4 MB of main-process heap and no RSS
    const allWebContents = webContents.getAllWebContents();

    // 3. Clear Chromium caches across all active webContents and defaultSession
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearHostResolverCache();
      await session.defaultSession.clearStorageData({
        storages: ['serviceworkers', 'cachestorage']
      });
    } catch (e) {
      console.warn('Cache clearing notice:', e);
    }

    // 4. Trim renderer working sets
    for (const wc of allWebContents) {
      if (!wc.isDestroyed()) {
        try {
          if (typeof wc.session?.clearCache === 'function') {
            await wc.session.clearCache();
          }
        } catch {}
      }
    }

    // Short await for asynchronous GC cycles to settle
    await new Promise((res) => setTimeout(res, 200));

    // Measure after
    const afterMetrics = app.getAppMetrics();
    let afterBytes = 0;
    for (const m of afterMetrics) {
      if (isLinux) {
        const mem = getLinuxProcessMemory(m.pid);
        afterBytes += mem ? mem.pssBytes : ((m.memory?.workingSetSize || 0) * 1024);
      } else {
        const priv = (m.memory?.privateBytes || 0) * 1024;
        afterBytes += priv > 0 ? priv : ((m.memory?.workingSetSize || 0) * 1024);
      }
    }

    const reclaimedBytes = Math.max(0, beforeBytes - afterBytes);
    const reclaimedMb = Math.round(reclaimedBytes / (1024 * 1024));

    return {
      success: true,
      reclaimedMb,
      reclaimedBytes,
    };
  } catch (err) {
    console.error('clean_ram error:', err);
    return { success: false, reclaimedMb: 0, reclaimedBytes: 0 };
  }
});

// Native file picker for custom background image (zero telemetry, strictly local)
handleUi('pick_custom_background', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Custom Background Image',
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${fileBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to load image:', e);
    return null;
  }
});

// Privacy settings mirrored from the renderer (Settings → Privacy). Defaults match src/settings/defaults.ts.
// HTTPS-only, secure DNS and spell check are also kept in storage-config.json, so they are in force
// for the tabs restored at startup, before the UI has sent its settings.
const privacyState = {
  doNotTrack: true,
  blockThirdPartyCookies: true,
  popupsBlocked: true,
  adBlockEnabled: true,
  checkForUpdates: true,
  httpsOnly: initialStorageConfig.httpsOnly === true,
  spellcheck: initialStorageConfig.spellcheck !== false,
  secureDns: netPrivacy.SECURE_DNS_CHOICES.includes(initialStorageConfig.secureDns) ? initialStorageConfig.secureDns : 'off',
  secureDnsCustomUrl: typeof initialStorageConfig.secureDnsCustomUrl === 'string' ? initialStorageConfig.secureDnsCustomUrl : '',
};
const PERSISTED_PRIVACY_KEYS = ['blockThirdPartyCookies', 'httpsOnly', 'spellcheck', 'secureDns', 'secureDnsCustomUrl'];

let appliedDnsKey = '';
function applySecureDns() {
  if (!app.isReady()) return;
  const options = netPrivacy.secureDnsOptions(privacyState.secureDns, privacyState.secureDnsCustomUrl);
  const key = JSON.stringify(options);
  if (key === appliedDnsKey) return;
  try {
    app.configureHostResolver(options);
    appliedDnsKey = key;
  } catch (err) {
    console.warn('[dns] configureHostResolver failed:', err.message);
  }
}

// Russian and English dictionaries in every tab session (Chromium downloads them on first use)
const SPELLCHECK_LANGUAGES = ['ru', 'en-US'];
function applySpellcheck(ses) {
  try {
    ses.setSpellCheckerEnabled(privacyState.spellcheck);
    if (privacyState.spellcheck && process.platform !== 'darwin') {
      const available = new Set(ses.availableSpellCheckerLanguages || []);
      const langs = SPELLCHECK_LANGUAGES.filter((l) => available.size === 0 || available.has(l));
      if (langs.length) ses.setSpellCheckerLanguages(langs);
    }
  } catch (err) {
    console.warn('[spellcheck]', err.message);
  }
}
function applySpellcheckEverywhere() {
  const sessions = new Set([session.defaultSession]);
  for (const wc of webContents.getAllWebContents()) if (wc.getType() === 'webview') sessions.add(wc.session);
  for (const ses of sessions) applySpellcheck(ses);
}

handleUi('set_privacy_settings', (event, next) => {
  if (next && typeof next === 'object') {
    for (const key of ['doNotTrack', 'blockThirdPartyCookies', 'popupsBlocked', 'adBlockEnabled', 'checkForUpdates', 'httpsOnly', 'spellcheck']) {
      if (typeof next[key] === 'boolean') privacyState[key] = next[key];
    }
    if (netPrivacy.SECURE_DNS_CHOICES.includes(next.secureDns)) privacyState.secureDns = next.secureDns;
    if (typeof next.secureDnsCustomUrl === 'string') privacyState.secureDnsCustomUrl = next.secureDnsCustomUrl.slice(0, 512);
  }
  adBlocker?.setEnabled(privacyState.adBlockEnabled);
  applySecureDns();
  applySpellcheckEverywhere();
  // Third-party cookies take effect through a command line switch at the next start; the rest is read at startup
  const stored = readStorageConfig();
  const changed = {};
  for (const key of PERSISTED_PRIVACY_KEYS) if (stored[key] !== privacyState[key]) changed[key] = privacyState[key];
  if (Object.keys(changed).length) writeStorageConfig(changed);
  return { ...privacyState };
});

// ---- HTTPS-only mode ----
// Top-level http:// navigations are redirected to https:// (electron/net-privacy.cjs decides which).
// When the https page then fails, the tab asks https_only_info and offers the http page instead.
const allowedHttpHosts = new Set(); // hosts the user opened over http anyway, until the browser closes
const httpsUpgrades = new Map(); // webContentsId -> { host, httpUrl, at }
const HTTPS_UPGRADE_TTL_MS = 5 * 60 * 1000;

function httpsOnlyRedirect(details) {
  if (!privacyState.httpsOnly || details.resourceType !== 'mainFrame' || details.method !== 'GET') return null;
  const wc = details.webContents;
  if (!wc || wc.isDestroyed() || wc.getType() !== 'webview') return null;
  const target = netPrivacy.httpsUpgradeTarget(details.url, allowedHttpHosts);
  if (!target) return null;
  if (!httpsUpgrades.has(wc.id)) wc.once('destroyed', () => httpsUpgrades.delete(wc.id));
  httpsUpgrades.set(wc.id, { host: new URL(target).hostname, httpUrl: details.url, at: Date.now() });
  return { redirectURL: target };
}

function upgradeFor(webContentsId, pageUrl) {
  const entry = httpsUpgrades.get(webContentsId);
  if (!entry || Date.now() - entry.at > HTTPS_UPGRADE_TTL_MS) return null;
  try {
    const u = new URL(pageUrl);
    if (u.protocol !== 'https:' || u.hostname !== entry.host) return null;
  } catch {
    return null;
  }
  return entry;
}

const isWebviewId = (id) => {
  const wc = webContents.fromId(Number(id));
  return Boolean(wc && !wc.isDestroyed() && wc.getType() === 'webview');
};

// The http address this failed https page was upgraded from, or null when the browser did not upgrade it
handleUi('https_only_info', (event, webContentsId, pageUrl) => {
  if (!isWebviewId(webContentsId)) return null;
  const entry = upgradeFor(Number(webContentsId), pageUrl);
  return entry ? { httpUrl: entry.httpUrl, host: entry.host } : null;
});

// "Open the http site": no more upgrades for this host until the browser closes
handleUi('https_only_allow', (event, webContentsId, pageUrl) => {
  if (!isWebviewId(webContentsId)) return null;
  const entry = upgradeFor(Number(webContentsId), pageUrl);
  if (!entry) return null;
  allowedHttpHosts.add(entry.host);
  httpsUpgrades.delete(Number(webContentsId));
  return entry.httpUrl;
});

// ---- Picture in picture ----
// Runs in each frame with a user gesture (requestPictureInPicture needs one). Leaves picture in picture
// when a video is already in it, otherwise takes the playing video, or the largest one.
const PIP_SCRIPT = `(async () => {
  if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return 'exited'; }
  if (!document.pictureInPictureEnabled) return 'none';
  const videos = [...document.querySelectorAll('video')].filter((v) => v.readyState > 0);
  if (!videos.length) return 'none';
  const area = (v) => { const r = v.getBoundingClientRect(); return r.width * r.height; };
  videos.sort((a, b) => (Number(!b.paused) - Number(!a.paused)) || (area(b) - area(a)));
  const video = videos[0];
  video.disablePictureInPicture = false;
  await video.requestPictureInPicture();
  return 'entered';
})().catch((err) => 'error: ' + err.message)`;

async function togglePictureInPicture(contents, preferredFrame) {
  if (!contents || contents.isDestroyed()) return 'none';
  const frames = [];
  if (preferredFrame && !preferredFrame.isDestroyed?.()) frames.push(preferredFrame);
  for (const frame of contents.mainFrame.framesInSubtree) if (!frames.includes(frame)) frames.push(frame);
  for (const frame of frames) {
    try {
      const result = await frame.executeJavaScript(PIP_SCRIPT, true);
      if (result === 'entered' || result === 'exited') return result;
    } catch {}
  }
  return 'none';
}

handleUi('tab_picture_in_picture', async (event, webContentsId) => {
  if (!isWebviewId(webContentsId)) return 'none';
  return togglePictureInPicture(webContents.fromId(Number(webContentsId)));
});

// ---- Built-in ad blocker (electron/adblock.cjs), created on app ready ----
let adBlocker = null;
// Sync call from electron/webview-preload.cjs at document start: page CSS is inserted, scriptlets returned
ipcMain.on('freedom-adblock-start', (event, pageUrl) => {
  if (event.sender.getType() !== 'webview') { event.returnValue = null; return; }
  try {
    event.returnValue = adBlocker?.pageStart(event.sender, pageUrl) ?? null;
  } catch (err) {
    console.warn('[adblock]', err);
    event.returnValue = null;
  }
});
ipcMain.on('freedom-adblock-dom', (event, pageUrl, dom) => {
  if (event.sender.getType() !== 'webview') return;
  try { adBlocker?.pageDom(event.sender, pageUrl, dom); } catch (err) { console.warn('[adblock]', err); }
});

// Approximate registrable domain ("sub.example.co.uk" -> "example.co.uk") for first/third-party checks
function siteOf(rawUrl) {
  try {
    const { hostname, protocol } = new URL(rawUrl);
    if (!/^https?:$/.test(protocol) || !hostname) return '';
    if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return hostname;
    const parts = hostname.split('.');
    const twoLevelSuffix = parts.length > 2 && /^(co|com|net|org|gov|edu|ac)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2;
    return parts.slice(twoLevelSuffix ? -3 : -2).join('.');
  } catch {
    return '';
  }
}

function isThirdPartyRequest(details) {
  if (!privacyState.blockThirdPartyCookies || details.resourceType === 'mainFrame') return false;
  let topUrl = '';
  try { topUrl = details.webContents ? details.webContents.getURL() : ''; } catch {}
  const topSite = siteOf(topUrl);
  const reqSite = siteOf(details.url);
  return Boolean(topSite && reqSite && topSite !== reqSite);
}

// Performance mode notification to main process
// Kept for the UI; the mode itself is applied in the renderer (a forced main-process gc gave nothing measurable)
handleUi('set_browser_mode', () => true);

// DevTools
handleUi('open_devtools', () => {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.webContents.toggleDevTools();
    return true;
  }
  return false;
});

// Downloads IPC: Native cross-platform downloads management
handleUi('open_download_folder', async (event, customFolder) => {
  let target = customFolder || activeDownloadsLocation || app.getPath('downloads');
  if (typeof target !== 'string') target = app.getPath('downloads');
  target = target.trim();
  if (target.startsWith('~/')) target = path.join(os.homedir(), target.slice(2));
  // shell.openPath runs whatever it is given: this channel only ever opens folders
  let isFolder = false;
  try { isFolder = fs.statSync(target).isDirectory(); } catch {}
  if (!isFolder) target = app.getPath('downloads');
  await shell.openPath(target);
  return true;
});

handleUi('open_download_file', async (event, filepath) => {
  if (!filepath || typeof filepath !== 'string') return false;
  if (!fs.existsSync(filepath)) return false;
  // Files of unknown origin (older history entries) and programs are confirmed in a dialog the UI cannot answer
  if (!browserDownloads.has(filepath) || isDangerousFile(filepath)) {
    const ru = currentAppLanguage === 'ru';
    const options = {
      type: 'warning',
      title: 'Freedom Browser',
      message: ru ? 'Открыть этот файл?' : 'Open this file?',
      detail: `${filepath}${isDangerousFile(filepath) ? `\n\n${ru ? 'Этот тип файла может запускать программы. Открывайте его, только если доверяете источнику.' : 'This type of file can run programs. Open it only if you trust its source.'}` : ''}`,
      buttons: [ru ? 'Отмена' : 'Cancel', ru ? 'Открыть' : 'Open'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    };
    const { response } = await (mainWindow && !mainWindow.isDestroyed() ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
    if (response !== 1) return false;
  }
  await shell.openPath(filepath);
  return true;
});

handleUi('show_item_in_folder', async (event, filepath) => {
  if (!filepath || typeof filepath !== 'string') return false;
  if (!fs.existsSync(filepath)) return false;
  shell.showItemInFolder(filepath);
  return true;
});

handleUi('cancel_download', (event, downloadId) => {
  const item = activeDownloads.get(downloadId);
  if (item && !item.isDestroyed?.()) {
    try {
      item.cancel();
      activeDownloads.delete(downloadId);
      return true;
    } catch (e) {
      console.warn('Failed to cancel download:', e);
    }
  }
  return false;
});

handleUi('verify_download_items', async (event, items) => {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item) return false;
    if (item.state === 'progressing') return true;
    return item.filepath && typeof item.filepath === 'string' && fs.existsSync(item.filepath);
  });
});

handleUi('get_default_download_dir', () => {
  return app.getPath('downloads');
});

handleUi('set_language', (event, lang) => {
  currentAppLanguage = lang === 'ru' ? 'ru' : 'en';
  return true;
});

handleUi('set_downloads_dir', (event, dirPath) => {
  if (dirPath && typeof dirPath === 'string') {
    activeDownloadsLocation = dirPath.trim();
  }
  return true;
});

handleUi('choose_download_dir', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: currentAppLanguage === 'ru' ? 'Выберите папку для загрузок' : 'Select Downloads Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  activeDownloadsLocation = result.filePaths[0];
  return activeDownloadsLocation;
});

handleUi('start_download', (event, { url }) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  session.defaultSession.downloadURL(url);
  return true;
});

handleUi('set_window_title', (event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title ? `${title} - Freedom Browser` : 'Freedom Browser');
  }
});

handleUi('close_app', () => {
  app.quit();
});

// Frameless Window Control Handlers
handleUi('window_minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return true;
  }
  return false;
});

handleUi('window_maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return mainWindow.isMaximized();
  }
  return false;
});

handleUi('window_close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return true;
  }
  return false;
});

handleUi('window_is_maximized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
});

// Direct WebContents Zoom Factor Handler
handleUi('set_zoom_factor', (event, { webContentsId, factor }) => {
  try {
    const { webContents } = require('electron');
    const target = webContents.fromId(webContentsId);
    const value = Number(factor);
    if (target && !target.isDestroyed() && target.getType() === 'webview' && value >= 0.25 && value <= 5) {
      target.setZoomFactor(value);
      return true;
    }
  } catch (err) {
    console.warn('Failed to set zoom factor:', err);
  }
  return false;
});

// User Data Storage Location (Settings → Telemetry & Logs). The move itself happens on the next start.
function folderSize(dir, depth = 0) {
  let total = 0;
  if (depth > 12) return 0;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    try {
      if (e.isDirectory()) total += folderSize(full, depth + 1);
      else if (e.isFile()) total += fs.statSync(full).size;
    } catch {}
  }
  return total;
}

handleUi('get_user_data_info', () => {
  const config = readStorageConfig();
  const current = app.getPath('userData');
  return {
    path: current,
    defaultPath: defaultUserDataDir,
    isDefault: path.resolve(current) === path.resolve(defaultUserDataDir),
    pendingPath: config.pendingUserDataPath || null,
    lastError: config.lastMoveError || null,
    sizeBytes: folderSize(current),
    cacheBytes: ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GPUPersistentCache']
      .reduce((sum, name) => sum + folderSize(path.join(current, name)), 0),
  };
});

// Kept for older renderer builds
handleUi('get_user_data_path', () => app.getPath('userData'));

handleUi('choose_user_data_path', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Freedom Browser User Data Directory',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// Only an empty folder or an existing Freedom profile, never inside the current profile:
// copying a profile into e.g. the home folder would scatter files all over it
function checkDataFolder(targetPath) {
  const target = path.resolve(targetPath);
  const current = path.resolve(app.getPath('userData'));
  if (target === current) return 'same';
  if (target.startsWith(current + path.sep) || current.startsWith(target + path.sep)) return 'nested';
  if (!fs.existsSync(target)) return 'ok';
  if (!fs.statSync(target).isDirectory()) return 'not-dir';
  try { fs.accessSync(target, fs.constants.W_OK); } catch { return 'not-writable'; }
  const entries = fs.readdirSync(target).filter((n) => !n.startsWith('.'));
  if (entries.length === 0 || entries.includes('Local State')) return 'ok';
  return 'not-empty';
}

handleUi('migrate_user_data_path', async (event, { targetPath, migrateExisting, reset }) => {
  try {
    const target = reset ? defaultUserDataDir : targetPath;
    if (!target || typeof target !== 'string' || !path.isAbsolute(target)) {
      return { success: false, error: 'invalid' };
    }
    const check = checkDataFolder(target);
    if (check === 'same') {
      writeStorageConfig({ pendingUserDataPath: null, pendingMigrate: null });
      return { success: true, newPath: target, pending: false };
    }
    if (check !== 'ok') return { success: false, error: check };
    writeStorageConfig({ pendingUserDataPath: path.resolve(target), pendingMigrate: Boolean(migrateExisting), lastMoveError: null });
    return { success: true, newPath: path.resolve(target), pending: true };
  } catch (err) {
    console.error('Failed to schedule user data move:', err);
    return { success: false, error: String(err) };
  }
});

handleUi('cancel_user_data_move', () => {
  writeStorageConfig({ pendingUserDataPath: null, pendingMigrate: null });
  return true;
});

handleUi('open_user_data_folder', () => shell.openPath(app.getPath('userData')));

// Hardware Acceleration IPC Handlers
handleUi('get_hardware_acceleration', () => {
  const config = readStorageConfig();
  return config.hardwareAcceleration !== false;
});

handleUi('set_hardware_acceleration', (event, enabled) => {
  writeStorageConfig({ hardwareAcceleration: Boolean(enabled) });
  return true;
});

// Renderer process limit (null = automatic). Applied at the next start.
handleUi('get_renderer_process_limit', () => validRendererLimit(readStorageConfig().rendererProcessLimit));
handleUi('set_renderer_process_limit', (event, limit) => {
  const value = limit === null ? null : validRendererLimit(Number(limit));
  if (limit !== null && value === null) return false;
  writeStorageConfig({ rendererProcessLimit: value });
  return true;
});

handleUi('relaunch_app', () => {
  app.relaunch();
  app.exit(0);
});

// Fullscreen Window Management IPC Handlers
handleUi('window_fullscreen_toggle', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const next = !mainWindow.isFullScreen();
    mainWindow.setFullScreen(next);
    return next;
  }
  return false;
});

handleUi('window_fullscreen_set', (event, flag) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(Boolean(flag));
    return mainWindow.isFullScreen();
  }
  return false;
});

handleUi('window_is_fullscreen', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isFullScreen() : false;
});

handleUi('force_close_app', () => {
  isForceQuitting = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  } else {
    app.quit();
  }
});

handleUi('choose_file_to_open', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open HTML Document',
    properties: ['openFile'],
    filters: [
      { name: 'HTML Documents', extensions: ['html', 'htm', 'xhtml', 'shtml'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return url.pathToFileURL(result.filePaths[0]).toString();
});

// Request hooks shared by the default profile and in-memory incognito partitions
const configuredSessions = new WeakSet();
function configureBrowsingSession(ses) {
  if (!ses || configuredSessions.has(ses)) return;
  configuredSessions.add(ses);
  permissionManager?.attach(ses);
  applySpellcheck(ses);
  ses.setUserAgent(desktopChromeUA);
  // Guarantee all outgoing HTTP/HTTPS requests advertise desktop Chrome without mobile hints
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = desktopChromeUA;
    details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
    details.requestHeaders['Sec-CH-UA'] = `"Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}", "Not:A-Brand";v="99"`;
    details.requestHeaders['Sec-CH-UA-Platform'] = isPlatformWin ? '"Windows"' : isPlatformMac ? '"macOS"' : '"Linux"';
    if (privacyState.doNotTrack) {
      details.requestHeaders['DNT'] = '1';
      details.requestHeaders['Sec-GPC'] = '1';
    }
    if (isThirdPartyRequest(details)) {
      delete details.requestHeaders['Cookie'];
    }
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // Ad & tracker blocking for pages in browser tabs
  adBlocker?.serveStubs(ses);
  // One listener per session: HTTPS-only upgrades first, then the ad blocker
  ses.webRequest.onBeforeRequest((details, callback) => {
    let verdict = null;
    try { verdict = httpsOnlyRedirect(details); } catch (err) { console.warn('[https-only]', err.message); }
    if (!verdict) {
      try { verdict = adBlocker?.matchRequest(details); } catch {}
    }
    callback(verdict || {});
  });

  // Third-party cookie blocking: drop Set-Cookie on cross-site subresource responses
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (details.responseHeaders && isThirdPartyRequest(details)) {
      for (const name of Object.keys(details.responseHeaders)) {
        if (name.toLowerCase() === 'set-cookie') delete details.responseHeaders[name];
      }
    }
    callback({ cancel: false, responseHeaders: details.responseHeaders });
  });
  if (ses !== session.defaultSession) {
    // Incognito downloads go through the same download manager (files are kept, like other browsers)
    ses.on('will-download', (...args) => session.defaultSession.emit('will-download', ...args));
  }
}

// Layout-independent letter shortcuts: match the physical key (KeyT) so Ctrl+T/W/... also work
// with Cyrillic and other layouts, where input.key would be 'е', 'ц', ...
function keyIs(input, letter) {
  return input.code === `Key${letter.toUpperCase()}` || (input.key || '').toLowerCase() === letter;
}

// ---- Chrome extensions (Settings → Extensions, toolbar puzzle button) ----
const { createExtensionManager } = require('./extensions.cjs');
let extensionManager = null;
const withExtensions = (fn) => async (...args) => {
  if (!extensionManager) throw new Error('Extensions are not ready yet');
  return fn(...args);
};

// Shown before any extension is installed: what it asks for, in a dialog the UI cannot answer
async function confirmExtensionInstall({ name, version, permissions, sites, source }) {
  const ru = currentAppLanguage === 'ru';
  const allSites = sites.some((p) => p === '<all_urls>' || p === '*://*/*' || p === 'http://*/*' || p === 'https://*/*');
  const lines = [
    ru ? `Источник: ${source}` : `Source: ${source}`,
    allSites
      ? (ru ? 'Сможет читать и изменять данные на ВСЕХ сайтах.' : 'Can read and change your data on ALL websites.')
      : sites.length ? `${ru ? 'Сайты' : 'Sites'}: ${sites.slice(0, 12).join(', ')}` : '',
    permissions.length ? `${ru ? 'Разрешения' : 'Permissions'}: ${permissions.join(', ')}` : '',
  ].filter(Boolean);
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: 'Freedom Browser',
    message: ru ? `Установить расширение «${name}» ${version || ''}?` : `Install extension "${name}" ${version || ''}?`,
    detail: lines.join('\n'),
    buttons: [ru ? 'Отмена' : 'Cancel', ru ? 'Установить' : 'Install'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  if (response !== 1) throw new Error(ru ? 'Установка отменена' : 'Installation cancelled');
}

handleUi('extensions_list', withExtensions(() => extensionManager.list()));
handleUi('extensions_install_folder', withExtensions(async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Select unpacked extension folder (with manifest.json)' });
  if (res.canceled || !res.filePaths[0]) return null;
  return extensionManager.installFromDir(res.filePaths[0]);
}));
handleUi('extensions_install_file', withExtensions(async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select extension package',
    filters: [{ name: 'Chrome extension', extensions: ['crx', 'zip'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return extensionManager.installFromArchive(fs.readFileSync(res.filePaths[0]), path.parse(res.filePaths[0]).name);
}));
handleUi('extensions_install_store', withExtensions((event, idOrUrl) => extensionManager.installFromWebStore(idOrUrl)));
handleUi('extensions_set_enabled', withExtensions((event, folder, enabled) => extensionManager.setEnabled(folder, Boolean(enabled))));
handleUi('extensions_remove', withExtensions((event, folder) => extensionManager.remove(folder)));

// Extension popup (action.default_popup) in a small window; options page in a normal tab
let extensionPopup = null;
handleUi('extensions_open', withExtensions((event, folder, kind, anchor) => {
  const ext = extensionManager.list().find((e) => e.folder === folder);
  if (!ext) return false;
  const url = extensionManager.pageUrl(folder, kind === 'options' ? ext.options : ext.popup);
  if (!url) return false;
  if (kind === 'options') {
    mainWindow?.webContents.send('webview-new-window', { url });
    return true;
  }
  if (extensionPopup && !extensionPopup.isDestroyed()) extensionPopup.close();
  const bounds = mainWindow.getBounds();
  const width = 380;
  const x = Math.round(bounds.x + Math.min(Math.max((anchor?.x ?? bounds.width) - width, 8), bounds.width - width - 8));
  const y = Math.round(bounds.y + (anchor?.y ?? 80));
  extensionPopup = new BrowserWindow({
    parent: mainWindow,
    x,
    y,
    width,
    height: 560,
    frame: false,
    resizable: true,
    show: false,
    backgroundColor: '#16191c',
    webPreferences: { session: session.defaultSession, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  routeNewWindows(extensionPopup.webContents);
  extensionPopup.loadURL(url);
  extensionPopup.once('ready-to-show', () => extensionPopup?.show());
  extensionPopup.on('blur', () => extensionPopup && !extensionPopup.isDestroyed() && extensionPopup.close());
  return true;
}));

// Settings → Privacy → Site permissions
handleUi('permissions_list', () => permissionManager?.list() || []);
handleUi('permissions_remove', (event, origin, permission) => permissionManager?.remove(origin, permission) || false);

// ---- New version check (Settings → Privacy) ----
// Security fixes reach users only through new releases, so tell them. Installing stays a user action:
// the builds are not code-signed, and silently replacing a browser binary needs signatures to be safe.
const EXTENSION_UPDATE_DELAY_MS = 60 * 1000;
const updater = createUpdater({
  app,
  session,
  onAvailable: (update) => mainWindow?.webContents.send('update-available', update),
  onProgress: (progress) => mainWindow?.webContents.send('update-progress', progress),
  quitApp: () => {
    isForceQuitting = true;
    app.quit();
  },
  isAutoCheckEnabled: () => privacyState.checkForUpdates,
  getSkippedVersion: () => readStorageConfig().skippedUpdateVersion,
  setSkippedVersion: (version) => writeStorageConfig({ skippedUpdateVersion: version }),
});
handleUi('update_check', () => updater.check());
handleUi('update_download', () => updater.download());
handleUi('update_cancel', () => updater.cancel());
handleUi('update_install', () => updater.install());
handleUi('update_skip', () => updater.skip());

// Versions before cookie encryption left values in plain text, and Chromium only encrypts a cookie when it is
// next written. Writing them all back once covers the ones a site would otherwise never touch again.
async function encryptOldCookies() {
  if (readStorageConfig().cookiesEncrypted) return;
  try {
    const cookies = await session.defaultSession.cookies.get({});
    for (const c of cookies) {
      const host = c.domain.replace(/^\./, '');
      await session.defaultSession.cookies.set({
        url: `${c.secure ? 'https' : 'http'}://${host}${c.path || '/'}`,
        name: c.name,
        value: c.value,
        ...(c.hostOnly ? {} : { domain: c.domain }),
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}),
      }).catch((err) => console.warn('[cookies] could not rewrite one cookie:', err.message));
    }
    await session.defaultSession.cookies.flushStore();
    writeStorageConfig({ cookiesEncrypted: true });
  } catch (err) {
    console.warn('[cookies] encryption pass failed:', err.message);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  app.userAgentFallback = desktopChromeUA;
  session.defaultSession.setUserAgent(desktopChromeUA);
  // Before any tab exists, so restored tabs never resolve names through the system first
  applySecureDns();

  permissionManager = createPermissionManager({
    app,
    session,
    dialog,
    windowFor: hostWindowOf,
    language: () => currentAppLanguage,
  });

  // The UI lives in a session of its own: no extensions, no site cookies, no file:// origin shared with tabs
  uiSession = session.fromPartition(UI_PARTITION);
  serveUi(uiSession, path.join(__dirname, '../dist'));
  permissionManager.attachDenyAll(uiSession);
  uiSession.on('will-download', (...args) => session.defaultSession.emit('will-download', ...args));
  await migrateUiStorage({ app, BrowserWindow, session, uiSession });
  await encryptOldCookies();

  adBlocker = createAdBlocker({ app, net });
  adBlocker.setEnabled(privacyState.adBlockEnabled);
  configureBrowsingSession(session.defaultSession);

  // Chrome extensions must be loaded on every start, before any page/webview is created
  extensionManager = createExtensionManager({ app, session, net, confirmInstall: confirmExtensionInstall });
  await extensionManager.loadAllOnStartup().catch((err) => console.warn('[extensions]', err));
  setTimeout(() => extensionManager.updateFromStore().catch((err) => console.warn('[extensions] update check:', err.message)), EXTENSION_UPDATE_DELAY_MS);

  registerLinuxDesktopIntegration();
  createWindow();
  startupComplete = true;
  updater.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Chromium delays localStorage writes for minutes after a burst of changes: save settings before leaving
app.on('before-quit', () => {
  uiSession?.flushStorageData();
});

app.on('window-all-closed', () => {
  // The hidden windows of the startup migration closing is not the user closing the browser
  if (startupComplete && process.platform !== 'darwin') {
    app.quit();
  }
});
