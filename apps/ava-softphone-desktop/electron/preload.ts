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
  getAppVersion: () => ipcRenderer.invoke('updater:app-version'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateAvailable: (cb: (info: { version: string }) => void) =>
    ipcRenderer.on('update-available', (_e, i) => cb(i)),
  onUpdateProgress: (cb: (p: { percent: number; bps: number }) => void) =>
    ipcRenderer.on('update-progress', (_e, p) => cb(p)),
  onUpdateDownloaded: (cb: (info: { version: string }) => void) =>
    ipcRenderer.on('update-downloaded', (_e, i) => cb(i)),
  onUpdateError: (cb: (msg: string) => void) =>
    ipcRenderer.on('update-error', (_e, m) => cb(m)),

  // Status from tray
  onSetStatus: (cb: (status: string) => void) =>
    ipcRenderer.on('set-status', (_e, status) => cb(status)),

  platform: process.platform,
});
