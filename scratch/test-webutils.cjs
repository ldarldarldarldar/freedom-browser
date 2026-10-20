const { app, BrowserWindow, webUtils } = require('electron');
console.log('webUtils:', typeof webUtils, typeof webUtils?.getPathForFile);
app.quit();
