import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';

export function wireUpdater(win: BrowserWindow) {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', () =>
    win.webContents.send('update-available')
  );
  autoUpdater.on('update-downloaded', () =>
    win.webContents.send('update-downloaded')
  );
  autoUpdater.on('error', (err) =>
    win.webContents.send('update-error', err?.message ?? String(err))
  );
}
