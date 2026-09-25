const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const subscription = (event, ...args) => listener(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  getSystemMetrics: () => ipcRenderer.invoke('get_system_task_manager_stats'),
  terminateProcess: (pid) => ipcRenderer.invoke('terminate_process', pid),
  openDevTools: () => ipcRenderer.invoke('open_devtools'),
  openDownloadFolder: (folder) => ipcRenderer.invoke('open_download_folder', folder),
  openFile: (filepath) => ipcRenderer.invoke('open_download_file', filepath),
  showItemInFolder: (filepath) => ipcRenderer.invoke('show_item_in_folder', filepath),
  cancelDownload: (id) => ipcRenderer.invoke('cancel_download', id),
  verifyDownloads: (items) => ipcRenderer.invoke('verify_download_items', items),
  getDefaultDownloadDir: () => ipcRenderer.invoke('get_default_download_dir'),
  startDownload: (options) => ipcRenderer.invoke('start_download', options),
  setTitle: (title) => ipcRenderer.invoke('set_window_title', title),
  closeApp: () => ipcRenderer.invoke('close_app'),
  pickCustomBackground: () => ipcRenderer.invoke('pick_custom_background'),
  setBrowserMode: (mode) => ipcRenderer.invoke('set_browser_mode', mode),
});
