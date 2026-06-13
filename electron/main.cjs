// Electron main process — loads the AVA Statistic / Lemtel portal in a native window.
// The desktop app intentionally mirrors the web portal 1:1 so every page the user
// sees in the browser is available in the desktop app.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const PORTAL_URL = process.env.PORTAL_URL || 'https://avastatistic.ca';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'AVA Statistic',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Allow microphone for the in-portal softphone.
      // permission is granted at runtime via setPermissionRequestHandler below.
    },
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    if (['media', 'audioCapture', 'videoCapture', 'notifications'].includes(permission)) {
      return callback(true);
    }
    callback(false);
  });

  // Open external links in default browser, keep internal navigation inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(PORTAL_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(PORTAL_URL);
  if (process.env.DEV_TOOLS === '1') win.webContents.openDevTools({ mode: 'detach' });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
