import { execFileSync } from 'node:child_process';

const MAX_BUFFER = 1024 * 1024 * 512;

export function runSqlJson(dbPath, sql) {
  const out = execFileSync('sqlite3', ['-json', dbPath, sql], {
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER
  });

  const text = String(out || '').trim();
  if (!text) {
    return [];
  }
  return JSON.parse(text);
}

export function escapeSqlString(input) {
  return String(input ?? '').replaceAll("'", "''");
}
