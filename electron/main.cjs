// Electron main process — loads the AVA Statistic / Lemtel portal in a native window.
// The desktop app intentionally mirrors the web portal 1:1, so every new admin page
// (sync health, sip profiles, dialplans, feature codes, call forwarding, recording
// rules, voicemail settings, conferences, hold music, time conditions, destinations)
// appears in the desktop app automatically as it's the same React bundle.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const PORTAL_URL = process.env.PORTAL_URL || 'https://avastatistic.ca';
const PROTOCOL = 'avastatistic';

// Register custom protocol so links like `avastatistic://lemtel/admin/sync-health`
// open the desktop app on the matching portal route.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

let mainWindow = null;

function routeFromDeepLink(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== `${PROTOCOL}:`) return null;
    // avastatistic://login?ava_token=XYZ  -> /login?ava_token=XYZ (auto-login)
    // avastatistic://lemtel/admin/sync-health -> /lemtel/admin/sync-health
    const pathPart = (u.host ? '/' + u.host : '') + (u.pathname || '');
    const cleanPath = pathPart.replace(/\/+/g, '/') || '/';
    const qs = u.search || '';
    return cleanPath + qs;
  } catch { return null; }
}

function navigateTo(route) {
  if (!mainWindow || !route) return;
  const target = new URL(route, PORTAL_URL).toString();
  mainWindow.loadURL(target);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'AVA Statistic',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Permissions: mic, camera, notifications, clipboard, and screen-share (for conferences).
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = [
      'media', 'audioCapture', 'videoCapture', 'notifications',
      'clipboard-read', 'clipboard-sanitized-write', 'display-capture',
    ];
    callback(allowed.includes(permission));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(PORTAL_URL)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Fallback if the portal fails to load (offline, transient error).
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, validatedUrl) => {
    if (code === -3) return; // user-aborted
    const html = `<!doctype html><meta charset="utf-8"><title>AVA Statistic — offline</title>
      <style>body{font:14px/1.5 -apple-system,system-ui,sans-serif;background:#0b0b14;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}div{max-width:480px;padding:24px;border:1px solid #1f2937;border-radius:12px;background:#111827}button{background:#0023e6;color:#fff;border:0;padding:10px 16px;border-radius:8px;cursor:pointer;margin-top:12px}</style>
      <div><h2>Connexion au portail impossible</h2>
      <p style="opacity:.7">${desc} (${code})<br>${validatedUrl}</p>
      <button onclick="location.href='${PORTAL_URL}'">Réessayer</button></div>`;
    mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });

  mainWindow.loadURL(PORTAL_URL);
  if (process.env.DEV_TOOLS === '1') mainWindow.webContents.openDevTools({ mode: 'detach' });
}

const menuTemplate = [
  {
    label: 'Portal',
    submenu: [
      { label: 'Reload portal', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.loadURL(PORTAL_URL) },
      { label: 'Open in browser', click: () => shell.openExternal(PORTAL_URL) },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  { role: 'editMenu' },
  {
    label: 'View',
    submenu: [
      { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  },
];

// Single-instance lock so protocol handlers focus the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const deepLink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (deepLink) navigateTo(routeFromDeepLink(deepLink));
    else if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    navigateTo(routeFromDeepLink(url));
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
