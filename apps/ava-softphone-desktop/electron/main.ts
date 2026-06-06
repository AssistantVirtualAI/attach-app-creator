import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import Store from 'electron-store';
import path from 'path';
import { setupTray, updateTrayStatus } from './tray';

const APP_NAME = 'Lemtel';
const store = new Store();
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

app.setName(APP_NAME);

function createWindow() {
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 380,
    height: 680,
    minWidth: 340,
    minHeight: 580,
    resizable: true,
    frame: false,
    transparent: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    alwaysOnTop: false,
    skipTaskbar: false,
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  setupTray(mainWindow);

  if (store.get('launchOnStartup', true)) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  autoUpdater.checkForUpdatesAndNotify().catch(() => {
    /* offline or no release channel — ignore */
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

// ---------- IPC ----------
ipcMain.handle('get-stored-credentials', () => store.get('credentials', null));
ipcMain.handle('save-credentials', (_e, credentials) => {
  store.set('credentials', credentials);
  return true;
});
ipcMain.handle('clear-credentials', () => {
  store.delete('credentials');
  return true;
});

ipcMain.handle('show-notification', (_e, { title, body }) => {
  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '../assets/icon.png'),
    urgency: 'critical',
  });
  notification.show();
  notification.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
});

ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.hide());
ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url));

ipcMain.handle('set-launch-on-startup', (_e, enabled: boolean) => {
  store.set('launchOnStartup', enabled);
  app.setLoginItemSettings({ openAtLogin: enabled });
});

ipcMain.handle('update-tray-status', (_e, status: string) => {
  updateTrayStatus(status);
});

// ---------- Auto-updater ----------
autoUpdater.on('update-available', () => {
  mainWindow?.webContents.send('update-available');
});
autoUpdater.on('update-downloaded', () => {
  mainWindow?.webContents.send('update-downloaded');
});
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates());
