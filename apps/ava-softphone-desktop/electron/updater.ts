import { autoUpdater } from 'electron-updater';
import { BrowserWindow, ipcMain, app } from 'electron';

export function wireUpdater(win: BrowserWindow) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console as any;

  const send = (channel: string, payload?: any) =>
    win.webContents.send(channel, payload);

  autoUpdater.on('checking-for-update', () => send('update-checking'));
  autoUpdater.on('update-available', (info) =>
    send('update-available', { version: info.version })
  );
  autoUpdater.on('update-not-available', () => send('update-none'));
  autoUpdater.on('download-progress', (p) =>
    send('update-progress', { percent: Math.round(p.percent), bps: p.bytesPerSecond })
  );
  autoUpdater.on('update-downloaded', (info) =>
    send('update-downloaded', { version: info.version })
  );
  autoUpdater.on('error', (err) =>
    send('update-error', err?.message ?? String(err))
  );

  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates());
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall());
  ipcMain.handle('updater:app-version', () => app.getVersion());

  // First check 5s after launch, then every hour
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5_000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000);
}
