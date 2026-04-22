import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

import { registerInsightsIpc } from './ipcHandlers.js';
import { ElectronAppRuntime } from './runtimeState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1280,
    minHeight: 840,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.resolve(__dirname, './preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.resolve(__dirname, '../static/index.html'));
  return window;
}

let runtime = null;

app.whenReady().then(() => {
  runtime = new ElectronAppRuntime({
    userDataPath: app.getPath('userData'),
    appDataPath: app.getPath('appData'),
    platform: process.platform,
    env: process.env,
    dialogImpl: dialog,
    shellImpl: shell
  });
  runtime.init();
  registerInsightsIpc({ ipcMain, runtime });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
