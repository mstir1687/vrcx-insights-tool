import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

describe('createFixtureDb', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('node:child_process');
  });

  test('creates fixture databases without relying on sqlite3 CLI availability', async () => {
    vi.doMock('node:child_process', () => ({
      execFileSync: vi.fn(() => {
        const error = new Error('spawnSync sqlite3 ENOENT');
        error.code = 'ENOENT';
        throw error;
      })
    }));

    const { createFixtureDb } = await import('../../test/fixtures/createFixtureDb.js');
    const { SqliteReadRepository } = await import('../../src/analyzer/sqliteReadRepository.js');

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-fixture-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite3');

    createFixtureDb(dbPath);

    const repo = new SqliteReadRepository(dbPath);
    expect(repo.getMeta().selfUserId).toBe('usr_self');
    repo.close();
  });
});
