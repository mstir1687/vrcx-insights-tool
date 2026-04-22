import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { SqliteReadRepository } from '../../src/analyzer/sqliteReadRepository.js';
import { createFixtureDb } from '../../test/fixtures/createFixtureDb.js';

describe('SqliteReadRepository', () => {
  test('loads metadata from a VRCX fixture database in read-only mode', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-read-repo-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite3');
    createFixtureDb(dbPath);

    const repo = new SqliteReadRepository(dbPath);
    const meta = repo.getMeta();

    expect(meta.selfUserId).toBe('usr_self');
    expect(meta.friendTable).toBe('usrself_friend_log_current');
    expect(meta.friendList.length).toBeGreaterThan(0);
    expect(meta.observedUntilMs).toBeGreaterThan(0);
    repo.close();
  });

  test('uses the self display name from local logs when self is missing from the friend table', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-read-repo-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite3');
    createFixtureDb(dbPath);

    const repo = new SqliteReadRepository(dbPath);
    const meta = repo.getMeta();

    expect(meta.selfDisplayName).toBe('Self');
    repo.close();
  });

  test('returns only bounded raw session inputs for the requested user and date range', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-read-repo-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite3');
    createFixtureDb(dbPath);

    const repo = new SqliteReadRepository(dbPath);
    const rows = repo.getUserSessionInputs('usr_self', {
      fromMs: Date.parse('2026-04-01T00:00:00.000Z'),
      toMs: Date.parse('2026-04-30T00:00:00.000Z')
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.userId === 'usr_self')).toBe(true);
    repo.close();
  });
});
