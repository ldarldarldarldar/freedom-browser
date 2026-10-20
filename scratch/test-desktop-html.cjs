const { app, BrowserWindow, webContents } = require('electron');
const path = require('path');
const fs = require('fs');

const desktopFile = '/home/royalxvii/Рабочий стол/homyak.html';
console.log('Testing launch with desktop cyrillic file:', desktopFile);

process.argv = [
  process.argv[0],
  path.join(__dirname, '../electron/main.cjs'),
  desktopFile
];

require('../electron/main.cjs');

app.whenReady().then(() => {
  setTimeout(async () => {
    const wins = BrowserWindow.getAllWindows();
    if (wins.length > 0) {
      const win = wins[0];
      const img = await win.capturePage();
      const outImg = path.join(__dirname, 'desktop-html-capture.png');
      fs.writeFileSync(outImg, img.toPNG());
      console.log('Successfully captured screenshot to:', outImg);

      const allWc = webContents.getAllWebContents();
      for (const wc of allWc) {
        console.log(`WebContents id=${wc.id} type=${wc.getType()} url=${wc.getURL()} title=${wc.getTitle()}`);
      }
    }
    app.quit();
  }, 4000);
});
