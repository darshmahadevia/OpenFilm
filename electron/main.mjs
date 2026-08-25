import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = !app.isPackaged;

function isExternalWebUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function loadWorkstation(window) {
  if (isDevelopment) {
    const developmentUrl = process.env.OPENFILM_DEV_SERVER_URL ?? 'http://127.0.0.1:5173';
    await window.loadURL(`${developmentUrl}/app.html?desktop=1`);
    return;
  }

  await window.loadFile(path.join(currentDirectory, '..', 'dist', 'app.html'), {
    query: { desktop: '1' },
  });
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 760,
    minHeight: 620,
    show: false,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    const currentUrl = window.webContents.getURL();
    if (url === currentUrl) return;
    event.preventDefault();
    if (isExternalWebUrl(url)) void shell.openExternal(url);
  });

  window.once('ready-to-show', () => window.show());
  void loadWorkstation(window);
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'OpenFilm',
    applicationVersion: app.getVersion(),
    copyright: 'OpenFilm is released under the MIT License.',
  });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
