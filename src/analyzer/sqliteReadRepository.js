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

function buildPlaceholders(list) {
  return list.map(() => '?').join(', ');
}

function runAll(db, sql, params = []) {
  return db.prepare(sql).all(...params);
}

function queryLatestDisplayName(db, tableName, userId) {
  if (!tableName || !userId) {
    return '';
  }
  return (
    db
      .prepare(
        `
        SELECT display_name AS displayName
        FROM ${tableName}
        WHERE user_id = ?
          AND display_name IS NOT NULL
          AND TRIM(display_name) != ''
        ORDER BY created_at DESC
        LIMIT 1
        `
      )
      .get(userId)?.displayName || ''
  );
}

function resolveSelfDisplayName(db, { selfUserId, friendList, feedGpsTable, feedOnlineOfflineTable }) {
  const friendName = friendList.find((row) => row.userId === selfUserId)?.displayName || '';
  if (friendName) {
    return friendName;
  }

  return (
    queryLatestDisplayName(db, 'gamelog_join_leave', selfUserId) ||
    queryLatestDisplayName(db, feedGpsTable, selfUserId) ||
    queryLatestDisplayName(db, feedOnlineOfflineTable, selfUserId) ||
    selfUserId
  );
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
    const selfDisplayName = resolveSelfDisplayName(this.db, {
      selfUserId,
      friendList,
      feedGpsTable,
      feedOnlineOfflineTable
    });

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
    const boundedFromMs = fromMs ?? 0;
    const boundedToMs = toMs ?? Number.MAX_SAFE_INTEGER;
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
        fromMs: boundedFromMs,
        toMs: boundedToMs
      });
  }

  getSessionInputsForUsers(userIds, { toMs = Number.MAX_SAFE_INTEGER } = {}) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean)));
    if (ids.length === 0) {
      return {
        localRows: [],
        feedGpsRows: [],
        feedOnlineOfflineRows: []
      };
    }

    const placeholders = buildPlaceholders(ids);
    const boundedToMs = toMs ?? Number.MAX_SAFE_INTEGER;
    const params = [...ids, boundedToMs];
    const meta = this.getMeta();

    const localRows = runAll(
      this.db,
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
        AND user_id IN (${placeholders})
        AND location IS NOT NULL
        AND location != ''
        AND unixepoch(created_at) * 1000 < ?
      ORDER BY created_at ASC
      `,
      params
    );

    const feedGpsRows = meta.feedGpsTable
      ? runAll(
          this.db,
          `
          SELECT
            created_at AS createdAt,
            user_id AS userId,
            display_name AS displayName,
            location,
            world_name AS worldName,
            previous_location AS previousLocation,
            time,
            group_name AS groupName
          FROM ${meta.feedGpsTable}
          WHERE user_id IN (${placeholders})
            AND location IS NOT NULL
            AND location != ''
            AND unixepoch(created_at) * 1000 < ?
          ORDER BY created_at ASC
          `,
          params
        )
      : [];

    const feedOnlineOfflineRows = meta.feedOnlineOfflineTable
      ? runAll(
          this.db,
          `
          SELECT
            created_at AS createdAt,
            user_id AS userId,
            display_name AS displayName,
            type,
            location,
            world_name AS worldName,
            time,
            group_name AS groupName
          FROM ${meta.feedOnlineOfflineTable}
          WHERE user_id IN (${placeholders})
            AND location IS NOT NULL
            AND location != ''
            AND (type = 'Online' OR type = 'Offline')
            AND unixepoch(created_at) * 1000 < ?
          ORDER BY created_at ASC
          `,
          params
        )
      : [];

    return {
      localRows,
      feedGpsRows,
      feedOnlineOfflineRows
    };
  }

  getSessionInputsForLocations(
    locations,
    { toMs = Number.MAX_SAFE_INTEGER, excludeUserIds = [], includeUserIds = null } = {}
  ) {
    const locationList = Array.from(new Set((locations || []).filter(Boolean)));
    if (locationList.length === 0) {
      return {
        localRows: [],
        feedGpsRows: [],
        feedOnlineOfflineRows: []
      };
    }

    const locationClause = buildPlaceholders(locationList);
    const filters = [];
    const params = [...locationList];

    if (Array.isArray(includeUserIds) && includeUserIds.length > 0) {
      filters.push(`AND user_id IN (${buildPlaceholders(includeUserIds)})`);
      params.push(...includeUserIds);
    }
    if (Array.isArray(excludeUserIds) && excludeUserIds.length > 0) {
      filters.push(`AND user_id NOT IN (${buildPlaceholders(excludeUserIds)})`);
      params.push(...excludeUserIds);
    }
    params.push(toMs ?? Number.MAX_SAFE_INTEGER);
    const extraFilterSql = filters.join('\n        ');
    const meta = this.getMeta();

    const localRows = runAll(
      this.db,
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
        AND location IN (${locationClause})
        AND location IS NOT NULL
        AND location != ''
        ${extraFilterSql}
        AND unixepoch(created_at) * 1000 < ?
      ORDER BY created_at ASC
      `,
      params
    );

    const feedGpsRows = meta.feedGpsTable
      ? runAll(
          this.db,
          `
          SELECT
            created_at AS createdAt,
            user_id AS userId,
            display_name AS displayName,
            location,
            world_name AS worldName,
            previous_location AS previousLocation,
            time,
            group_name AS groupName
          FROM ${meta.feedGpsTable}
          WHERE (location IN (${locationClause}) OR previous_location IN (${locationClause}))
            AND location IS NOT NULL
            AND location != ''
            ${extraFilterSql}
            AND unixepoch(created_at) * 1000 < ?
          ORDER BY created_at ASC
          `,
          [...locationList, ...locationList, ...params.slice(locationList.length)]
        )
      : [];

    const feedOnlineOfflineRows = meta.feedOnlineOfflineTable
      ? runAll(
          this.db,
          `
          SELECT
            created_at AS createdAt,
            user_id AS userId,
            display_name AS displayName,
            type,
            location,
            world_name AS worldName,
            time,
            group_name AS groupName
          FROM ${meta.feedOnlineOfflineTable}
          WHERE location IN (${locationClause})
            AND location IS NOT NULL
            AND location != ''
            AND (type = 'Online' OR type = 'Offline')
            ${extraFilterSql}
            AND unixepoch(created_at) * 1000 < ?
          ORDER BY created_at ASC
          `,
          params
        )
      : [];

    return {
      localRows,
      feedGpsRows,
      feedOnlineOfflineRows
    };
  }

  getLocationMetadata(locations) {
    const locationList = Array.from(new Set((locations || []).filter(Boolean)));
    if (locationList.length === 0) {
      return new Map();
    }

    const rows = runAll(
      this.db,
      `
      SELECT
        location,
        world_name AS worldName,
        group_name AS groupName,
        world_id AS worldId,
        created_at AS createdAt
      FROM gamelog_location
      WHERE location IN (${buildPlaceholders(locationList)})
      ORDER BY created_at DESC
      `,
      locationList
    );

    const locationMetaByLocation = new Map();
    for (const row of rows) {
      if (!locationMetaByLocation.has(row.location)) {
        locationMetaByLocation.set(row.location, {
          worldName: row.worldName,
          groupName: row.groupName || '',
          worldId: row.worldId || ''
        });
      }
    }
    return locationMetaByLocation;
  }

  close() {
    this.db.close();
  }
}
