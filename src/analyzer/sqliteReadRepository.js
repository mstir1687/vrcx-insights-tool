import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

function toUserPrefix(userId) {
  let prefix = String(userId || '').replaceAll('-', '').replaceAll('_', '');
  if (/^\d/.test(prefix)) {
    prefix = `_${prefix}`;
  }
  return prefix;
}

function findExistingTable(db, expectedName, likePattern) {
  const exact = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1")
    .get(expectedName);
  if (exact?.name) {
    return exact.name;
  }
  if (!likePattern) {
    return '';
  }
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE ? ORDER BY name LIMIT 1")
      .get(likePattern)?.name || ''
  );
}

function parseObservedAtMs(value) {
  const observedAtMs = Date.parse(String(value || ''));
  return Number.isNaN(observedAtMs) ? 0 : observedAtMs;
}

export class SqliteReadRepository {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new DatabaseSync(dbPath, {
      open: true,
      readOnly: true
    });
    this.db.exec('PRAGMA query_only = 1');
    this.meta = null;
  }

  getMeta() {
    if (this.meta) {
      return this.meta;
    }

    const selfUserId =
      this.db
        .prepare("SELECT value FROM configs WHERE key = 'config:lastuserloggedin' LIMIT 1")
        .get()?.value || '';
    if (!selfUserId) {
      throw new Error('cannot find config:lastuserloggedin in configs table');
    }

    const prefix = toUserPrefix(selfUserId);
    const friendTable = findExistingTable(this.db, `${prefix}_friend_log_current`, '%_friend_log_current');
    if (!friendTable) {
      throw new Error('cannot find *_friend_log_current table');
    }

    const feedGpsTable = findExistingTable(this.db, `${prefix}_feed_gps`, '%_feed_gps');
    const feedOnlineOfflineTable = findExistingTable(
      this.db,
      `${prefix}_feed_online_offline`,
      '%_feed_online_offline'
    );

    const friendList = this.db
      .prepare(
        `SELECT user_id AS userId, display_name AS displayName, trust_level AS trustLevel FROM ${friendTable}`
      )
      .all()
      .map((row) => ({
        userId: row.userId,
        displayName: row.displayName || row.userId,
        trustLevel: row.trustLevel || ''
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const friendSet = new Set(friendList.map((row) => row.userId).filter(Boolean));
    const selfDisplayName = friendList.find((row) => row.userId === selfUserId)?.displayName || selfUserId;

    this.meta = {
      dbPath: this.dbPath,
      selfUserId,
      selfDisplayName,
      friendTable,
      feedGpsTable,
      feedOnlineOfflineTable,
      friendList,
      friendSet,
      observedUntilMs: this.getObservedUntilMs({
        feedGpsTable,
        feedOnlineOfflineTable
      })
    };
    return this.meta;
  }

  getObservedUntilMs({ feedGpsTable, feedOnlineOfflineTable } = {}) {
    const tables = [
      'gamelog_location',
      'gamelog_join_leave',
      ...(feedGpsTable ? [feedGpsTable] : []),
      ...(feedOnlineOfflineTable ? [feedOnlineOfflineTable] : [])
    ];

    let observedUntilMs = 0;
    for (const tableName of tables) {
      const row = this.db.prepare(`SELECT MAX(created_at) AS createdAt FROM ${tableName}`).get();
      observedUntilMs = Math.max(observedUntilMs, parseObservedAtMs(row?.createdAt));
    }
    return observedUntilMs;
  }

  getUserSessionInputs(userId, { fromMs = 0, toMs = Number.MAX_SAFE_INTEGER } = {}) {
    return this.db
      .prepare(
        `
        SELECT
          created_at AS createdAt,
          user_id AS userId,
          display_name AS displayName,
          location,
          time,
          'local' AS source
        FROM gamelog_join_leave
        WHERE type = 'OnPlayerLeft'
          AND time > 0
          AND user_id = @userId
          AND location IS NOT NULL
          AND location != ''
          AND unixepoch(created_at) * 1000 >= @fromMs
          AND unixepoch(created_at) * 1000 < @toMs
        ORDER BY created_at ASC
        `
      )
      .all({
        userId,
        fromMs,
        toMs
      });
  }

  close() {
    this.db.close();
  }
}
