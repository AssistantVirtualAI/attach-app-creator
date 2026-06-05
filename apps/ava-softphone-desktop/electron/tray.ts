import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function setupTray(mainWindow: BrowserWindow | null) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/tray-icon.png')
  );

  tray = new Tray(icon);
  tray.setToolTip('AVA Softphone');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open AVA Softphone',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Status',
      submenu: [
        {
          label: '🟢 Available',
          click: () =>
            mainWindow?.webContents.send('set-status', 'available'),
        },
        {
          label: '🔴 Busy',
          click: () => mainWindow?.webContents.send('set-status', 'busy'),
        },
        {
          label: '⛔ Do Not Disturb',
          click: () => mainWindow?.webContents.send('set-status', 'dnd'),
        },
        {
          label: '🟡 Away',
          click: () => mainWindow?.webContents.send('set-status', 'away'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Quit AVA Softphone',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) mainWindow.focus();
    else mainWindow?.show();
  });
}

export function updateTrayStatus(status: string) {
  const iconName =
    status === 'active-call' ? 'tray-icon-active.png' : 'tray-icon.png';
  tray?.setImage(
    nativeImage.createFromPath(path.join(__dirname, `../assets/${iconName}`))
  );
  tray?.setToolTip(
    status === 'active-call'
      ? 'AVA Softphone — On a call'
      : 'AVA Softphone'
  );
}
