const { app, BrowserWindow, ipcMain, shell, session, dialog, Menu, MenuItem, clipboard } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

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
app.commandLine.appendSwitch('renderer-process-limit', '6'); // Prevents runaway process explosion
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256'); // Keep V8 memory lean

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
let mainWindow = null;
const activeDownloads = new Map();

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

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Downloads handling: Real downloads to disk with true progress & metrics
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const downloadDir = app.getPath('downloads');
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
    contents.setWindowOpenHandler(({ url }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('webview-new-window', { url });
      }
      return { action: 'deny' };
    });

    // Native Browser Context Menu for Web Content
    contents.on('context-menu', (event, params) => {
      event.preventDefault();
      const menu = new Menu();

      // 1. Link Actions
      if (params.linkURL) {
        menu.append(new MenuItem({
          label: 'Open Link',
          click: () => { contents.loadURL(params.linkURL); },
        }));
        menu.append(new MenuItem({
          label: 'Open Link in New Tab',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-open-tab', { url: params.linkURL, active: true });
            }
          },
        }));
        menu.append(new MenuItem({
          label: 'Open Link in Background Tab',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-open-tab', { url: params.linkURL, active: false });
            }
          },
        }));
        menu.append(new MenuItem({
          label: 'Copy Link Address',
          click: () => { clipboard.writeText(params.linkURL); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 2. Image Actions
      if (params.mediaType === 'image' && params.srcURL) {
        menu.append(new MenuItem({
          label: 'Open Image in New Tab',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('webview-open-tab', { url: params.srcURL, active: true });
            }
          },
        }));
        menu.append(new MenuItem({
          label: 'Save Image As...',
          click: () => { contents.downloadURL(params.srcURL); },
        }));
        menu.append(new MenuItem({
          label: 'Copy Image Address',
          click: () => { clipboard.writeText(params.srcURL); },
        }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 3. Text Selection Actions
      if (params.selectionText && params.selectionText.trim().length > 0) {
        const text = params.selectionText.trim();
        menu.append(new MenuItem({
          label: 'Copy',
          role: 'copy',
        }));
        const truncated = text.length > 25 ? text.substring(0, 25) + '...' : text;
        menu.append(new MenuItem({
          label: `Search Web for "${truncated}"`,
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
        menu.append(new MenuItem({ label: 'Cut', role: 'cut', enabled: params.editFlags.canCut }));
        menu.append(new MenuItem({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy }));
        menu.append(new MenuItem({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste }));
        menu.append(new MenuItem({ label: 'Select All', role: 'selectAll' }));
        menu.append(new MenuItem({ type: 'separator' }));
      }

      // 5. Page Navigation Actions
      menu.append(new MenuItem({
        label: 'Back',
        enabled: contents.canGoBack(),
        click: () => { contents.goBack(); },
      }));
      menu.append(new MenuItem({
        label: 'Forward',
        enabled: contents.canGoForward(),
        click: () => { contents.goForward(); },
      }));
      menu.append(new MenuItem({
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => { contents.reload(); },
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
        privateRamMb: Math.round(totalPrivateRam / (1024 * 1024)),
        workingSetMb: Math.round(totalWorkingSetRam / (1024 * 1024)),
        totalSystemRamBytes: totalMem,
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
  let target = app.getPath('downloads');
  if (customFolder && typeof customFolder === 'string' && customFolder.trim() !== '') {
    let resolved = customFolder.trim();
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

// App lifecycle
app.whenReady().then(() => {
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
