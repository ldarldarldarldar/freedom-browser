const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-test.cjs'),
      contextIsolation: true
    }
  });

  win.loadURL('about:blank');
  win.webContents.on('console-message', (e, level, msg) => {
    console.log('PRELOAD MSG:', msg);
    app.quit();
  });
});
