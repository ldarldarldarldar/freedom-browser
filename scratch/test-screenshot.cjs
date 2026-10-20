const { app, BrowserWindow, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

// Simulate electron/main.cjs with the actual app
process.argv = [
  process.argv[0],
  path.join(__dirname, '../electron/main.cjs'),
  '/home/royalxvii/Рабочий стол/NeonPyatov.html'
];

require('../electron/main.cjs');

app.whenReady().then(() => {
  setTimeout(async () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      const image = await win.capturePage();
      fs.writeFileSync('/home/royalxvii/Downloads/freedom-browser/scratch/freedom-capture.png', image.toPNG());
      console.log('CAPTURED screenshot to scratch/freedom-capture.png. Win URL:', win.webContents.getURL());
      
      // Also inspect all webContents (webviews)
      const allWc = webContents.getAllWebContents();
      console.log('Total webContents:', allWc.length);
      for (const wc of allWc) {
        console.log('WC id:', wc.id, 'type:', wc.getType(), 'url:', wc.getURL(), 'title:', wc.getTitle());
      }
    }
    app.quit();
  }, 4000);
});
