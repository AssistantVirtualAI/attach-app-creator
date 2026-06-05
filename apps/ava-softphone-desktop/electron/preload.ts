import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials (encrypted via electron-store)
  getCredentials: () => ipcRenderer.invoke('get-stored-credentials'),
  saveCredentials: (creds: object) =>
    ipcRenderer.invoke('save-credentials', creds),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', { title, body }),

  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Startup
  setLaunchOnStartup: (enabled: boolean) =>
    ipcRenderer.invoke('set-launch-on-startup', enabled),

  // Tray
  updateTrayStatus: (status: string) =>
    ipcRenderer.invoke('update-tray-status', status),

  // Updates
  onUpdateAvailable: (cb: () => void) =>
    ipcRenderer.on('update-available', cb),
  onUpdateDownloaded: (cb: () => void) =>
    ipcRenderer.on('update-downloaded', cb),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Status from tray
  onSetStatus: (cb: (status: string) => void) =>
    ipcRenderer.on('set-status', (_e, status) => cb(status)),

  platform: process.platform,
});
