import fs from 'node:fs';
import path from 'node:path';

import { buildIndexInWorker } from '../analyzer/indexBuilderAsync.js';
import { InsightsService } from '../analyzer/insightsService.js';

export function getConfigFilePath(userDataPath) {
  return path.join(userDataPath, 'data.json');
}

export function getVrcxSqlitePath(dataDir) {
  if (!dataDir) {
    return '';
  }
  return path.join(dataDir, 'VRCX.sqlite3');
}

export function getWindowsDefaultDataDir({ env = process.env, appDataPath = '' } = {}) {
  const roamingRoot = env.APPDATA || appDataPath;
  if (!roamingRoot) {
    return '';
  }
  return path.join(roamingRoot, 'VRCX');
}

function readStoredConfig(configPath, fsImpl) {
  try {
    const raw = fsImpl.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      dataDir: typeof parsed?.dataDir === 'string' ? parsed.dataDir : ''
    };
  } catch (_error) {
    return { dataDir: '' };
  }
}

function writeStoredConfig(configPath, config, fsImpl) {
  fsImpl.mkdirSync(path.dirname(configPath), { recursive: true });
  fsImpl.writeFileSync(
    configPath,
    JSON.stringify(
      {
        dataDir: config.dataDir || ''
      },
      null,
      2
    ),
    'utf8'
  );
}

function hasValidDbFile(fsImpl, dbPath) {
  return Boolean(dbPath) && fsImpl.existsSync(dbPath);
}

function createEmptyState({ configPath, platform, source = 'unset', dataDir = '', dbPath = '' }) {
  return {
    platform,
    configPath,
    source,
    dataDir,
    dbPath,
    requiresOnboarding: !dbPath
  };
}

export class ElectronAppRuntime {
  constructor({
    userDataPath,
    appDataPath,
    platform = process.platform,
    env = process.env,
    fsImpl = fs,
    dialogImpl = null,
    serviceFactory = (dbPath) => new InsightsService(dbPath),
    reloadIndexAsync = buildIndexInWorker
  }) {
    this.userDataPath = userDataPath;
    this.appDataPath = appDataPath;
    this.platform = platform;
    this.env = env;
    this.fs = fsImpl;
    this.dialog = dialogImpl;
    this.serviceFactory = serviceFactory;
    this.reloadIndexAsync = reloadIndexAsync;
    this.configPath = getConfigFilePath(userDataPath);
    this.service = null;
    this.state = createEmptyState({
      configPath: this.configPath,
      platform: this.platform
    });
  }

  createServiceFor(dbPath) {
    const service = this.serviceFactory(dbPath);
    service.reload();
    return service;
  }

  applyReadyState({ dataDir, dbPath, source, persist }) {
    const service = this.createServiceFor(dbPath);
    if (persist) {
      writeStoredConfig(this.configPath, { dataDir }, this.fs);
    }
    this.service = service;
    this.state = createEmptyState({
      configPath: this.configPath,
      platform: this.platform,
      source,
      dataDir,
      dbPath
    });
    return this.getState();
  }

  init() {
    const savedConfig = readStoredConfig(this.configPath, this.fs);
    const savedDataDir = savedConfig.dataDir || '';
    const savedDbPath = getVrcxSqlitePath(savedDataDir);

    if (hasValidDbFile(this.fs, this.env.VRCX_DB_PATH)) {
      return this.applyReadyState({
        dataDir: path.dirname(this.env.VRCX_DB_PATH),
        dbPath: this.env.VRCX_DB_PATH,
        source: 'env',
        persist: false
      });
    }

    if (hasValidDbFile(this.fs, savedDbPath)) {
      return this.applyReadyState({
        dataDir: savedDataDir,
        dbPath: savedDbPath,
        source: 'saved',
        persist: false
      });
    }

    if (this.platform === 'win32') {
      const defaultDataDir = getWindowsDefaultDataDir({
        env: this.env,
        appDataPath: this.appDataPath
      });
      const defaultDbPath = getVrcxSqlitePath(defaultDataDir);
      if (hasValidDbFile(this.fs, defaultDbPath)) {
        return this.applyReadyState({
          dataDir: defaultDataDir,
          dbPath: defaultDbPath,
          source: 'windows-default',
          persist: true
        });
      }
    }

    this.service = null;
    this.state = createEmptyState({
      configPath: this.configPath,
      platform: this.platform
    });
    return this.getState();
  }

  getState() {
    return { ...this.state };
  }

  getService() {
    if (!this.service) {
      throw new Error('请先完成VRCX数据文件夹设置');
    }
    return this.service;
  }

  async reload() {
    const service = this.getService();
    service.index = await this.reloadIndexAsync(service.dbPath);
    return service.getMeta();
  }

  updateDataDirectory(dataDir) {
    const normalized = typeof dataDir === 'string' ? dataDir.trim() : '';
    const dbPath = getVrcxSqlitePath(normalized);
    if (!hasValidDbFile(this.fs, dbPath)) {
      throw new Error('所选文件夹下未找到 VRCX.sqlite3');
    }

    return this.applyReadyState({
      dataDir: normalized,
      dbPath,
      source: 'manual',
      persist: true
    });
  }

  async chooseDataDirectory(browserWindow = null) {
    if (!this.dialog || typeof this.dialog.showOpenDialog !== 'function') {
      throw new Error('目录选择器不可用');
    }

    const result = await this.dialog.showOpenDialog(browserWindow, {
      title: '选择VRCX数据文件夹',
      buttonLabel: '使用该文件夹',
      properties: ['openDirectory']
    });

    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return {
        ...this.getState(),
        canceled: true
      };
    }

    return {
      ...this.updateDataDirectory(result.filePaths[0]),
      canceled: false
    };
  }
}
