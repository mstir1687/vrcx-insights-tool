import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainJsPath = path.resolve(__dirname, '../../src/electron/main.js');
const preloadCjsPath = path.resolve(__dirname, '../../src/electron/preload.cjs');

describe('electron preload runtime', () => {
  test('uses a CommonJS preload bridge file', () => {
    const mainSource = fs.readFileSync(mainJsPath, 'utf8');
    const preloadSource = fs.readFileSync(preloadCjsPath, 'utf8');

    expect(mainSource).toContain("preload.cjs");
    expect(preloadSource).toContain("require('electron')");
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld('vrcxInsights'");
    expect(preloadSource).toContain('getAppState: () => ipcRenderer.invoke(\'app:get-state\')');
    expect(preloadSource).toContain(
      'chooseDataDirectory: () => ipcRenderer.invoke(\'app:choose-data-directory\')'
    );
    expect(preloadSource).toContain(
      'updateDataDirectory: (dataDir) => ipcRenderer.invoke(\'app:update-data-directory\', { dataDir })'
    );
    expect(preloadSource).toContain(
      'openExternalUrl: (url) => ipcRenderer.invoke(\'app:open-external-url\', { url })'
    );
    expect(preloadSource).toContain('openDevTools: () => ipcRenderer.invoke(\'app:open-devtools\')');
  });
});
