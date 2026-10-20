const { app, BrowserWindow } = require("electron");
const path = require("path");

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
      <webview id="wv" src="file:///home/royalxvii/Downloads/freedom-browser/index.html" style="width:500px;height:500px;"></webview>
      <script>
        const wv = document.getElementById("wv");
        wv.addEventListener("did-start-loading", () => console.log("WEBVIEW did-start-loading"));
        wv.addEventListener("did-finish-load", () => console.log("WEBVIEW did-finish-load"));
        wv.addEventListener("did-fail-load", (e) => console.log("WEBVIEW did-fail-load: code=" + e.errorCode + " desc=" + e.errorDescription + " url=" + e.validatedURL));
        wv.addEventListener("dom-ready", () => console.log("WEBVIEW dom-ready"));
      </script>
    </body>
    </html>
  `));

  win.webContents.on("console-message", (e, level, msg) => {
    console.log("CONSOLE:", msg);
  });

  setTimeout(() => {
    app.quit();
  }, 3000);
});
