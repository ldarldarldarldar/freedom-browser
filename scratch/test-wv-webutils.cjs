const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      webviewTag: true,
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  win.loadURL("data:text/html," + encodeURIComponent(`
    <!DOCTYPE html>
    <html>
    <body>
      <webview id="wv" src="data:text/html,<h1>test</h1>" preload="file://${path.join(__dirname, 'wv-preload-test.cjs')}" style="width:300px;height:300px;"></webview>
    </body>
    </html>
  `));

  win.webContents.on('console-message', (e, level, msg) => {
    console.log('WV MSG:', msg);
    if (msg.includes('WV webUtils')) {
      app.quit();
    }
  });
});
