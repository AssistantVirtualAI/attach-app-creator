import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  shell,
  systemPreferences,
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

// Register lemtel:// custom protocol
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('lemtel', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('lemtel');
}

// Ensure single-instance so protocol launches focus the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function handleProtocolUrl(url: string | undefined) {
  if (!url || !url.startsWith('lemtel://')) return;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'call') {
      const number = parsed.pathname.replace(/^\//, '');
      mainWindow?.webContents.send('protocol-call', { number });
    }
  } catch {
    /* ignore malformed protocol urls */
  }
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  const url = commandLine.find((arg) => arg.startsWith('lemtel://'));
  handleProtocolUrl(url);
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  handleProtocolUrl(url);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1280,
    height: 820,
    minWidth: 360,
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

  // Auto-grant media/notification permissions to our own window so the SIP
  // softphone can access the microphone, speaker output, and notifications
  // without an extra Chromium prompt on top of the OS-level prompt.
  const session = mainWindow?.webContents.session;
  if (session) {
    session.setPermissionRequestHandler((_wc, permission, callback) => {
      const allowed = new Set([
        'media',
        'audioCapture',
        'videoCapture',
        'notifications',
        'background-sync',
        'clipboard-read',
      ]);
      callback(allowed.has(permission));
    });
    session.setPermissionCheckHandler((_wc, permission) => {
      return ['media', 'audioCapture', 'videoCapture', 'notifications'].includes(permission);
    });
  }

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

// Tagged notifications so we can dismiss them on answer/hangup.
const activeNotifications = new Map<string, Notification>();

ipcMain.handle('show-notification', (_e, { title, body, tag, urgent }: { title: string; body: string; tag?: string; urgent?: boolean }) => {
  // Replace existing notification with the same tag.
  if (tag && activeNotifications.has(tag)) {
    try { activeNotifications.get(tag)?.close(); } catch { /* noop */ }
    activeNotifications.delete(tag);
  }
  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '../assets/icon.png'),
    urgency: urgent ? 'critical' : 'normal',
  });
  notification.show();
  notification.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
    if (tag) {
      mainWindow?.webContents.send('notification-clicked', { tag });
    }
  });
  notification.on('close', () => {
    if (tag) activeNotifications.delete(tag);
  });
  if (tag) activeNotifications.set(tag, notification);
});

ipcMain.handle('clear-notification', (_e, { tag }: { tag: string }) => {
  const n = activeNotifications.get(tag);
  if (n) {
    try { n.close(); } catch { /* noop */ }
    activeNotifications.delete(tag);
  }
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
