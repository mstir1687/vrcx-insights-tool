import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test, vi } from 'vitest';

import {
  ElectronAppRuntime,
  getConfigFilePath,
  getVrcxSqlitePath,
  getWindowsDefaultDataDir
} from '../../src/electron/runtimeState.js';

describe('electron runtime state', () => {
  test('derives config and sqlite paths from the selected data directory', () => {
    expect(getConfigFilePath('/tmp/vrcx-user')).toBe(path.join('/tmp/vrcx-user', 'data.json'));
    expect(getVrcxSqlitePath('/tmp/vrcx-data')).toBe(path.join('/tmp/vrcx-data', 'VRCX.sqlite3'));
  });

  test('uses the Windows roaming VRCX directory by default when it exists', () => {
    const appDataPath = path.join('C:', 'Users', 'tester', 'AppData', 'Roaming');
    const expectedDataDir = path.join(appDataPath, 'VRCX');
    const expectedDbPath = path.join(expectedDataDir, 'VRCX.sqlite3');
    const service = { reload: vi.fn() };

    const runtime = new ElectronAppRuntime({
      userDataPath: '/tmp/vrcx-user',
      appDataPath,
      platform: 'win32',
      fsImpl: {
        existsSync(target) {
          return target === expectedDbPath;
        },
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(() => {
          throw new Error('missing');
        })
      },
      serviceFactory: vi.fn(() => service)
    });

    const state = runtime.init();

    expect(getWindowsDefaultDataDir({ appDataPath })).toBe(expectedDataDir);
    expect(state.requiresOnboarding).toBe(false);
    expect(state.dataDir).toBe(expectedDataDir);
    expect(state.dbPath).toBe(expectedDbPath);
    expect(state.source).toBe('windows-default');
    expect(service.reload).toHaveBeenCalledTimes(1);
  });

  test('requires onboarding on non-Windows when no saved data directory is available', () => {
    const runtime = new ElectronAppRuntime({
      userDataPath: '/tmp/vrcx-user',
      appDataPath: '/tmp/app-data',
      platform: 'darwin',
      fsImpl: {
        existsSync: vi.fn(() => false),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(() => {
          throw new Error('missing');
        })
      },
      serviceFactory: vi.fn()
    });

    const state = runtime.init();

    expect(state.requiresOnboarding).toBe(true);
    expect(state.dataDir).toBe('');
    expect(state.dbPath).toBe('');
  });

  test('persists the chosen data directory into data.json and recreates the service', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-runtime-'));
    const userDataPath = path.join(tempDir, 'user-data');
    const dataDir = path.join(tempDir, 'VRCX');
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'VRCX.sqlite3'), '');

    const reload = vi.fn();
    const runtime = new ElectronAppRuntime({
      userDataPath,
      appDataPath: path.join(tempDir, 'app-data'),
      platform: 'darwin',
      serviceFactory: vi.fn(() => ({ reload }))
    });

    runtime.init();
    const state = runtime.updateDataDirectory(dataDir);

    expect(state.requiresOnboarding).toBe(false);
    expect(state.dataDir).toBe(dataDir);
    expect(reload).toHaveBeenCalledTimes(1);

    const saved = JSON.parse(fs.readFileSync(path.join(userDataPath, 'data.json'), 'utf8'));
    expect(saved).toEqual({ dataDir });
  });

  test('reload clears analysis caches and refreshes metadata without rebuilding a full index', async () => {
    const dbPath = '/tmp/VRCX.sqlite3';
    const service = {
      dbPath,
      clearAnalysisCaches: vi.fn(),
      refreshMeta: vi.fn(() => ({ dbPath, selfUserId: 'usr_self' })),
      getMeta: vi.fn(() => ({ dbPath, selfUserId: 'usr_self' }))
    };

    const runtime = new ElectronAppRuntime({
      userDataPath: '/tmp/vrcx-user',
      appDataPath: '/tmp/app-data',
      platform: 'darwin',
      fsImpl: {
        existsSync: vi.fn(() => false),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(() => {
          throw new Error('missing');
        })
      },
      serviceFactory: vi.fn(() => service)
    });

    runtime.service = service;
    runtime.state = {
      ...runtime.state,
      dbPath,
      dataDir: '/tmp',
      requiresOnboarding: false
    };

    const meta = await runtime.reload();

    expect(service.clearAnalysisCaches).toHaveBeenCalledTimes(1);
    expect(service.refreshMeta).toHaveBeenCalledTimes(1);
    expect(meta).toEqual({ dbPath, selfUserId: 'usr_self' });
  });

  test('opens external urls with the injected shell bridge', async () => {
    const openExternal = vi.fn(async () => undefined);
    const runtime = new ElectronAppRuntime({
      userDataPath: '/tmp/vrcx-user',
      appDataPath: '/tmp/app-data',
      platform: 'darwin',
      fsImpl: {
        existsSync: vi.fn(() => false),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(() => {
          throw new Error('missing');
        })
      },
      shellImpl: {
        openExternal
      },
      serviceFactory: vi.fn()
    });

    await runtime.openExternalUrl('https://github.com/meng-luo/vrcx-insights-tool');

    expect(openExternal).toHaveBeenCalledTimes(1);
    expect(openExternal).toHaveBeenCalledWith('https://github.com/meng-luo/vrcx-insights-tool');
  });

  test('opens renderer devtools on the current browser window', async () => {
    const openDevTools = vi.fn();
    const runtime = new ElectronAppRuntime({
      userDataPath: '/tmp/vrcx-user',
      appDataPath: '/tmp/app-data',
      platform: 'darwin',
      fsImpl: {
        existsSync: vi.fn(() => false),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
        readFileSync: vi.fn(() => {
          throw new Error('missing');
        })
      },
      serviceFactory: vi.fn()
    });

    const result = await runtime.openDevTools({
      webContents: {
        openDevTools
      }
    });

    expect(openDevTools).toHaveBeenCalledTimes(1);
    expect(openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
    expect(result).toEqual({ ok: true });
  });
});
