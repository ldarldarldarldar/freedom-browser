const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Runs sandboxed. The UI gets named functions and these events only, never raw access to IPC.
const EVENT_CHANNELS = new Set([
  'download-completed',
  'download-progress',
  'download-start',
  'open-external-url',
  'request-app-close',
  'update-available',
  'update-progress',
  'webview-html-fullscreen',
  'webview-new-window',
  'webview-open-tab',
  'webview-search-text',
  'webview-shortcut',
  'webview-zoom-in',
  'webview-zoom-out',
  'webview-zoom-reset',
  'window-fullscreen-change',
  'window-maximized-change',
]);

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  homeDir: decodeURIComponent((process.argv.find((a) => a.startsWith('--freedom-home-dir=')) || '=').split('=')[1]),
  on: (channel, listener) => {
    if (!EVENT_CHANNELS.has(channel)) throw new Error(`Unknown event channel: ${channel}`);
    const subscription = (event, ...args) => listener(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {
      console.warn('getPathForFile error:', e);
    }
    return (file && file.path) || '';
  },
  getSystemMetrics: () => ipcRenderer.invoke('get_system_task_manager_stats'),
  cleanRam: () => ipcRenderer.invoke('clean_ram'),
  terminateProcess: (pid) => ipcRenderer.invoke('terminate_process', pid),
  openDevTools: () => ipcRenderer.invoke('open_devtools'),
  openDownloadFolder: (folder) => ipcRenderer.invoke('open_download_folder', folder),
  openFile: (filepath) => ipcRenderer.invoke('open_download_file', filepath),
  showItemInFolder: (filepath) => ipcRenderer.invoke('show_item_in_folder', filepath),
  cancelDownload: (id) => ipcRenderer.invoke('cancel_download', id),
  verifyDownloads: (items) => ipcRenderer.invoke('verify_download_items', items),
  getDefaultDownloadDir: () => ipcRenderer.invoke('get_default_download_dir'),
  setDownloadsDir: (dir) => ipcRenderer.invoke('set_downloads_dir', dir),
  chooseDownloadDir: () => ipcRenderer.invoke('choose_download_dir'),
  setLanguage: (lang) => ipcRenderer.invoke('set_language', lang),
  startDownload: (options) => ipcRenderer.invoke('start_download', options),
  setTitle: (title) => ipcRenderer.invoke('set_window_title', title),
  closeApp: () => ipcRenderer.invoke('close_app'),
  pickCustomBackground: () => ipcRenderer.invoke('pick_custom_background'),
  setBrowserMode: (mode) => ipcRenderer.invoke('set_browser_mode', mode),
  setPrivacySettings: (settings) => ipcRenderer.invoke('set_privacy_settings', settings),
  setDownloadSpeedLimit: (kbps) => ipcRenderer.invoke('set_download_speed_limit', kbps),
  updates: {
    check: () => ipcRenderer.invoke('update_check'),
    download: () => ipcRenderer.invoke('update_download'),
    cancel: () => ipcRenderer.invoke('update_cancel'),
    install: () => ipcRenderer.invoke('update_install'),
    skip: () => ipcRenderer.invoke('update_skip'),
  },
  sitePermissions: {
    list: () => ipcRenderer.invoke('permissions_list'),
    remove: (origin, permission) => ipcRenderer.invoke('permissions_remove', origin, permission),
  },
  extensions: {
    list: () => ipcRenderer.invoke('extensions_list'),
    installFolder: () => ipcRenderer.invoke('extensions_install_folder'),
    installFile: () => ipcRenderer.invoke('extensions_install_file'),
    installFromStore: (idOrUrl) => ipcRenderer.invoke('extensions_install_store', idOrUrl),
    setEnabled: (folder, enabled) => ipcRenderer.invoke('extensions_set_enabled', folder, enabled),
    remove: (folder) => ipcRenderer.invoke('extensions_remove', folder),
    open: (folder, kind, anchor) => ipcRenderer.invoke('extensions_open', folder, kind, anchor),
  },
  minimizeWindow: () => ipcRenderer.invoke('window_minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window_maximize'),
  closeWindow: () => ipcRenderer.invoke('window_close'),
  isWindowMaximized: () => ipcRenderer.invoke('window_is_maximized'),
  setZoomFactor: (webContentsId, factor) => ipcRenderer.invoke('set_zoom_factor', { webContentsId, factor }),
  getWebviewsMemory: (mappings) => ipcRenderer.invoke('get_webviews_memory', mappings),
  getUserDataPath: () => ipcRenderer.invoke('get_user_data_path'),
  chooseUserDataPath: () => ipcRenderer.invoke('choose_user_data_path'),
  migrateUserDataPath: (options) => ipcRenderer.invoke('migrate_user_data_path', options),
  getUserDataInfo: () => ipcRenderer.invoke('get_user_data_info'),
  cancelUserDataMove: () => ipcRenderer.invoke('cancel_user_data_move'),
  openUserDataFolder: () => ipcRenderer.invoke('open_user_data_folder'),
  relaunchApp: () => ipcRenderer.invoke('relaunch_app'),
  chooseFileToOpen: () => ipcRenderer.invoke('choose_file_to_open'),
  getHardwareAcceleration: () => ipcRenderer.invoke('get_hardware_acceleration'),
  setHardwareAcceleration: (enabled) => ipcRenderer.invoke('set_hardware_acceleration', enabled),
  toggleFullScreen: () => ipcRenderer.invoke('window_fullscreen_toggle'),
  setFullScreen: (flag) => ipcRenderer.invoke('window_fullscreen_set', flag),
  isFullScreen: () => ipcRenderer.invoke('window_is_fullscreen'),
  forceCloseApp: () => ipcRenderer.invoke('force_close_app'),
});
