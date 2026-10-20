const { app, BrowserWindow, ipcMain, shell, session, dialog, Menu, MenuItem, clipboard, webContents } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const url = require('url');

// User Data Storage Path Configuration
// Separates application binaries (e.g. Program Files\Freedom Browser) from user data (profiles, history, bookmarks, cookies).
// Defaults to user-writable %APPDATA%\Freedom Browser\User Data on Windows or ~/.config/freedom-browser/User Data on Linux.
const storageConfigFile = path.join(app.getPath('appData'), 'Freedom Browser', 'storage-config.json');
let activeUserDataDir = path.join(app.getPath('appData'), 'Freedom Browser', 'User Data');

try {
  if (fs.existsSync(storageConfigFile)) {
    const raw = fs.readFileSync(storageConfigFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.userDataPath && typeof parsed.userDataPath === 'string') {
      activeUserDataDir = parsed.userDataPath;
    }
  }
} catch (err) {
  console.warn('Failed to parse storage-config.json, using default user data path:', err);
}

try {
  fs.mkdirSync(activeUserDataDir, { recursive: true });
  app.setPath('userData', activeUserDataDir);
} catch (err) {
  console.warn('Failed to set custom userData path, falling back:', err);
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
app.commandLine.appendSwitch('no-default-browser-check');
app.commandLine.appendSwitch('disable-features', 'MediaRouter,OptimizationHints,InterestFeedContentSuggestions,Translate,CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('renderer-process-limit', '6'); // Prevents runaway process explosion
app.commandLine.appendSwitch('disk-cache-size', '67108864'); // 64MB disk cache (keeps working set lean)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512'); // Ensure sufficient V8 heap for modern complex WebApps and Google Sign-in

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
let mainWindow = null;
const activeDownloads = new Map();
let activeDownloadsLocation = '';
let currentAppLanguage = 'en';
let pendingOpenUrl = null;

const isPlatformWin = process.platform === 'win32';
const isPlatformMac = process.platform === 'darwin';

// Unified authentic Desktop Chrome User-Agent across all web navigation and authentication flows
const desktopChromeUA = isPlatformWin
  ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
  : isPlatformMac
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'
  : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

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
  if (process.platform !== 'linux') return;
  try {
    const homeDir = os.homedir();
    const appsDir = path.join(homeDir, '.local', 'share', 'applications');
    const iconsDir = path.join(homeDir, '.local', 'share', 'icons', 'hicolor', '512x512', 'apps');
    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(iconsDir, { recursive: true });

    // Determine target executable
    let targetExec = process.env.APPIMAGE || '';
    if (!targetExec) {
      const candidates = [
        path.join(__dirname, '../Freedom Browser.AppImage'),
        path.join(__dirname, '../Freedom.AppImage'),
        path.join(__dirname, '../release/Freedom-0.5.4-7.3.AppImage'),
        process.execPath,
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          targetExec = cand;
          break;
        }
      }
    }
    if (!targetExec) targetExec = process.execPath;

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
Exec="${targetExec}" %U
Terminal=false
Type=Application
Icon=freedom-browser
StartupWMClass=freedom-browser
MimeType=text/html;text/xml;application/xhtml+xml;x-scheme-handler/http;x-scheme-handler/https;
Categories=Network;WebBrowser;
`;

    fs.writeFileSync(desktopFile, desktopContent, 'utf8');

    // Register with mimeapps.list
    const mimeConfigFile = path.join(homeDir, '.config', 'mimeapps.list');
    let mimeContent = fs.existsSync(mimeConfigFile) ? fs.readFileSync(mimeConfigFile, 'utf8') : '';
    const associations = [
      'text/html=freedom-browser.desktop;',
      'text/xml=freedom-browser.desktop;',
      'application/xhtml+xml=freedom-browser.desktop;',
      'x-scheme-handler/http=freedom-browser.desktop;',
      'x-scheme-handler/https=freedom-browser.desktop;'
    ];

    if (!mimeContent.includes('[Added Associations]')) {
      mimeContent = `[Added Associations]\n` + associations.join('\n') + '\n\n' + mimeContent;
      fs.writeFileSync(mimeConfigFile, mimeContent, 'utf8');
    } else {
      let modified = false;
      for (const assoc of associations) {
        const mimeType = assoc.split('=')[0];
        if (!mimeContent.includes(mimeType + '=')) {
          mimeContent = mimeContent.replace('[Added Associations]', `[Added Associations]\n${assoc}`);
          modified = true;
        } else if (!mimeContent.includes('freedom-browser.desktop')) {
          const regex = new RegExp(`(${mimeType}=)([^\\n]+)`);
          mimeContent = mimeContent.replace(regex, `$1freedom-browser.desktop;$2`);
          modified = true;
        }
      }
      if (modified) {
        fs.writeFileSync(mimeConfigFile, mimeContent, 'utf8');
      }
    }

    const { exec } = require('child_process');
    exec(`update-desktop-database "${appsDir}" 2>/dev/null`, () => {});
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
  },
};

// Helper: Generate safe non-colliding filepath in destination directory
function getUniqueFilePath(dir, originalFilename) {
  let filename = (originalFilename || 'download').replace(/[\\/:*?"<>|]/g, '_');
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let target = path.join(dir, filename);
  let counter = 1;
  while (fs.existsSync(target)) {
    filename = `${base} (${counter})${ext}`;
    target = path.join(dir, filename);
    counter++;
  }
  return target;
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '../build/icons/icon.ico')
    : path.join(__dirname, '../build/icons/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 500,
    backgroundColor: '#06080b',
    title: 'Freedom Browser',
    icon: iconPath,
    frame: false, // Completely eliminates OS title bar and native borders (Frameless window)
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false, // Disables background spellcheck memory footprint
      sandbox: false,
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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query });
  }

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
    const finalDownloadPath = getUniqueFilePath(downloadDir, originalFilename);
    item.setSavePath(finalDownloadPath);

    const downloadId = 'dl-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    activeDownloads.set(downloadId, item);

    const startTime = Date.now();
    const downloadUrl = item.getURL();
    const totalBytes = item.getTotalBytes() || 0;

    // Send immediate start event with real initial metadata
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-start', {
        id: downloadId,
        filename: path.basename(finalDownloadPath),
        url: downloadUrl,
        filepath: finalDownloadPath,
        totalBytes,
        receivedBytes: 0,
        state: 'progressing',
        startTime,
        speedBps: 0,
      });
    }

    item.on('updated', (evt, state) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes() || totalBytes;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speed = elapsedSec > 0 ? Math.round(received / elapsedSec) : 0;

        mainWindow.webContents.send('download-progress', {
          id: downloadId,
          filename: path.basename(finalDownloadPath),
          url: downloadUrl,
          filepath: finalDownloadPath,
          receivedBytes: received,
          totalBytes: total,
          state: state === 'progressing' ? 'progressing' : 'paused',
          startTime,
          speedBps: speed,
        });
      }
    });

    item.once('done', (evt, state) => {
      activeDownloads.delete(downloadId);
      const existsOnDisk = fs.existsSync(finalDownloadPath);
      const isCompleted = state === 'completed' && existsOnDisk;
      const finalState = isCompleted ? 'completed' : (state === 'cancelled' ? 'cancelled' : 'interrupted');

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-completed', {
          id: downloadId,
          filename: path.basename(finalDownloadPath),
          url: downloadUrl,
          filepath: finalDownloadPath,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes() || item.getReceivedBytes(),
          state: finalState,
          startTime,
          speedBps: 0,
        });
      }
    });
  });
}

// Webview contents creation & security
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setUserAgent(desktopChromeUA);

    contents.setWindowOpenHandler(({ url }) => {
      // Allow Google Sign-In, account registration & OAuth popups so they can authenticate and communicate with window.opener
      const isAuthPopup = /google\.|appleid\.apple\.|login\.microsoftonline\.|github\.com\/login\/oauth|\/oauth|\/signin|\/signup|\/auth/i.test(url || '');
      if (isAuthPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: {
              contextIsolation: true,
              nodeIntegration: false,
              javascript: true,
            }
          }
        };
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-new-window', { url });
      }
      return { action: 'deny' };
    });

    // Intercept keyboard shortcuts inside webview before page can swallow them
    contents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;

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
      if (input.key.toLowerCase() === 't' && !input.shift) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'new-tab');
        return;
      }
      if (input.key.toLowerCase() === 'w') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'close-tab');
        return;
      }
      if (input.key.toLowerCase() === 't' && input.shift) {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'restore-tab');
        return;
      }
      if (input.key.toLowerCase() === 'l') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'focus-url');
        return;
      }
      if (input.key.toLowerCase() === 'f') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'find-in-page');
        return;
      }
      if (input.key.toLowerCase() === 'h') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'open-history');
        return;
      }
      if (input.key.toLowerCase() === 'd') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'toggle-bookmark');
        return;
      }
      if (input.key.toLowerCase() === 'j') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'open-downloads');
        return;
      }
      if (input.key.toLowerCase() === 'o') {
        event.preventDefault();
        mainWindow?.webContents.send('webview-shortcut', 'open-file');
        return;
      }
      if (input.key.toLowerCase() === 'r') {
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

      // 1. Link Actions
      if (params.linkURL) {
        menu.append(new MenuItem({
          label: i18n.openLink,
          click: () => { contents.loadURL(params.linkURL); },
        }));
        menu.append(new MenuItem({
          label: i18n.openLinkNewTab,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-open-tab', { url: params.linkURL, active: true });
            }
          },
        }));
        menu.append(new MenuItem({
          label: i18n.openLinkBgTab,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-open-tab', { url: params.linkURL, active: false });
            }
          },
        }));
        menu.append(new MenuItem({
          label: i18n.copyLinkAddress,
          click: () => { clipboard.writeText(params.linkURL); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 2. Image Actions
      if (params.mediaType === 'image' && params.srcURL) {
        menu.append(new MenuItem({
          label: i18n.openImageNewTab,
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-open-tab', { url: params.srcURL, active: true });
            }
          },
        }));
        menu.append(new MenuItem({
          label: i18n.saveImageAs,
          click: () => { contents.downloadURL(params.srcURL); },
        }));
        menu.append(new MenuItem({
          label: i18n.copyImageAddress,
          click: () => { clipboard.writeText(params.srcURL); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 3. Text Selection Actions
      if (params.selectionText && params.selectionText.trim().length > 0) {
        const text = params.selectionText.trim();
        menu.append(new MenuItem({
          label: i18n.copy,
          role: 'copy',
        }));
        const truncated = text.length > 25 ? text.substring(0, 25) + '...' : text;
        menu.append(new MenuItem({
          label: i18n.searchWebFor.replace('%s', truncated),
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-search-text', { text });
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
ipcMain.handle('get_system_task_manager_stats', async () => {
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
ipcMain.handle('get_webviews_memory', async (event, mappings) => {
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
ipcMain.handle('terminate_process', (event, pid) => {
  try {
    process.kill(pid);
    return true;
  } catch (err) {
    console.warn(`Failed to terminate PID ${pid}:`, err);
    return false;
  }
});

// Freedom RAM Control (FRC) - Manual memory reclamation / clean RAM
ipcMain.handle('clean_ram', async () => {
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

    // 1. Invoke V8 isolate GC in main process if exposed
    if (global.gc) {
      try { global.gc(); } catch {}
    }

    // 2. Clear Chromium caches across all active webContents and defaultSession
    try {
      await session.defaultSession.clearCache();
      await session.defaultSession.clearHostResolverCache();
      await session.defaultSession.clearStorageData({
        storages: ['serviceworkers', 'cachestorage']
      });
    } catch (e) {
      console.warn('Cache clearing notice:', e);
    }

    // 3. Trim renderer working sets
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed()) {
        try {
          if (typeof wc.session?.clearCache === 'function') {
            await wc.session.clearCache();
          }
        } catch {}
      }
    }

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
ipcMain.handle('pick_custom_background', async () => {
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

// Performance mode notification to main process
ipcMain.handle('set_browser_mode', (event, mode) => {
  if (mode === 'performance') {
    // In performance mode, trigger GC in all web contents and main process to reclaim idle heap
    if (global.gc) {
      try { global.gc(); } catch {}
    }
  }
  return true;
});

// DevTools
ipcMain.handle('open_devtools', () => {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused) {
    focused.webContents.toggleDevTools();
    return true;
  }
  return false;
});

// Downloads IPC: Native cross-platform downloads management
ipcMain.handle('open_download_folder', async (event, customFolder) => {
  let target = customFolder || activeDownloadsLocation || app.getPath('downloads');
  if (target && typeof target === 'string' && target.trim() !== '') {
    let resolved = target.trim();
    if (resolved.startsWith('~/')) {
      resolved = path.join(os.homedir(), resolved.slice(2));
    }
    if (fs.existsSync(resolved)) {
      target = resolved;
    }
  }
  if (!fs.existsSync(target)) {
    try {
      fs.mkdirSync(target, { recursive: true });
    } catch (e) {
      target = app.getPath('downloads');
    }
  }
  await shell.openPath(target);
  return true;
});

ipcMain.handle('open_download_file', async (event, filepath) => {
  if (!filepath || typeof filepath !== 'string') return false;
  if (!fs.existsSync(filepath)) return false;
  await shell.openPath(filepath);
  return true;
});

ipcMain.handle('show_item_in_folder', async (event, filepath) => {
  if (!filepath || typeof filepath !== 'string') return false;
  if (!fs.existsSync(filepath)) return false;
  shell.showItemInFolder(filepath);
  return true;
});

ipcMain.handle('cancel_download', (event, downloadId) => {
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

ipcMain.handle('verify_download_items', async (event, items) => {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item) return false;
    if (item.state === 'progressing') return true;
    return item.filepath && typeof item.filepath === 'string' && fs.existsSync(item.filepath);
  });
});

ipcMain.handle('get_default_download_dir', () => {
  return app.getPath('downloads');
});

ipcMain.handle('set_language', (event, lang) => {
  currentAppLanguage = lang === 'ru' ? 'ru' : 'en';
  return true;
});

ipcMain.handle('set_downloads_dir', (event, dirPath) => {
  if (dirPath && typeof dirPath === 'string') {
    activeDownloadsLocation = dirPath.trim();
  }
  return true;
});

ipcMain.handle('choose_download_dir', async () => {
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

ipcMain.handle('start_download', (event, { url }) => {
  if (mainWindow && !mainWindow.isDestroyed() && url) {
    mainWindow.webContents.downloadURL(url);
    return true;
  }
  return false;
});

ipcMain.handle('set_window_title', (event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title ? `${title} - Freedom Browser` : 'Freedom Browser');
  }
});

ipcMain.handle('close_app', () => {
  app.quit();
});

// Frameless Window Control Handlers
ipcMain.handle('window_minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
    return true;
  }
  return false;
});

ipcMain.handle('window_maximize', () => {
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

ipcMain.handle('window_close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    return true;
  }
  return false;
});

ipcMain.handle('window_is_maximized', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
});

// Direct WebContents Zoom Factor Handler
ipcMain.handle('set_zoom_factor', (event, { webContentsId, factor }) => {
  try {
    const { webContents } = require('electron');
    const target = webContents.fromId(webContentsId);
    if (target && !target.isDestroyed()) {
      target.setZoomFactor(factor);
      return true;
    }
  } catch (err) {
    console.warn('Failed to set zoom factor:', err);
  }
  return false;
});

// User Data Storage Location & Migration Handlers
ipcMain.handle('get_user_data_path', () => {
  return app.getPath('userData');
});

ipcMain.handle('choose_user_data_path', async () => {
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

ipcMain.handle('migrate_user_data_path', async (event, { targetPath, migrateExisting }) => {
  try {
    if (!targetPath || typeof targetPath !== 'string') {
      return { success: false, error: 'Invalid directory path' };
    }
    const currentPath = app.getPath('userData');
    if (path.resolve(currentPath) === path.resolve(targetPath)) {
      return { success: true, newPath: currentPath };
    }

    // Ensure target exists
    fs.mkdirSync(targetPath, { recursive: true });

    // Optionally copy existing data to new path
    if (migrateExisting && fs.existsSync(currentPath)) {
      fs.cpSync(currentPath, targetPath, { recursive: true, errorOnExist: false });
    }

    // Persist configuration
    const configDir = path.dirname(storageConfigFile);
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      storageConfigFile,
      JSON.stringify({ userDataPath: targetPath, updatedAt: Date.now() }, null, 2),
      'utf8'
    );

    return { success: true, newPath: targetPath };
  } catch (err) {
    console.error('Failed to migrate user data path:', err);
    return { success: false, error: String(err) };
  }
});

ipcMain.handle('relaunch_app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('choose_file_to_open', async () => {
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

// App lifecycle
app.whenReady().then(() => {
  app.userAgentFallback = desktopChromeUA;
  session.defaultSession.setUserAgent(desktopChromeUA);

  // Guarantee all outgoing HTTP/HTTPS requests advertise desktop Chrome without mobile hints
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = desktopChromeUA;
    details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
    details.requestHeaders['Sec-CH-UA'] = '"Chromium";v="132", "Google Chrome";v="132", "Not:A-Brand";v="99"';
    details.requestHeaders['Sec-CH-UA-Platform'] = isPlatformWin ? '"Windows"' : isPlatformMac ? '"macOS"' : '"Linux"';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  registerLinuxDesktopIntegration();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
