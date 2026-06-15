import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import path from 'path';

let tray: Tray | null = null;
const APP_NAME = 'Lemtel Telecom';

export function setupTray(mainWindow: BrowserWindow | null) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/tray-icon.png')
  );

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open ${APP_NAME}`,
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
          accelerator: 'CmdOrCtrl+Shift+1',
          click: () =>
            mainWindow?.webContents.send('set-ui-status', 'available'),
        },
        {
          label: '🔴 Busy',
          accelerator: 'CmdOrCtrl+Shift+2',
          click: () =>
            mainWindow?.webContents.send('set-ui-status', 'busy'),
        },
        {
          label: '🟡 In a meeting',
          accelerator: 'CmdOrCtrl+Shift+3',
          click: () =>
            mainWindow?.webContents.send('set-ui-status', 'meeting'),
        },
        {
          label: '⚪ Not available',
          accelerator: 'CmdOrCtrl+Shift+4',
          click: () =>
            mainWindow?.webContents.send('set-ui-status', 'away'),
        },
      ],
    },
    { type: 'separator' },
    {
      label: `Quit ${APP_NAME}`,
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
      ? `${APP_NAME} — On a call`
      : APP_NAME
  );
}
