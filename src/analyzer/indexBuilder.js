import { escapeSqlString, runSqlJson } from './sqliteCli.js';
import { calculatePeakOccupancy } from './overlap.js';
import { parseLocationDetails } from './locationDetails.js';

function toUserPrefix(userId) {
  let prefix = String(userId || '').replaceAll('-', '').replaceAll('_', '');
  if (/^\d/.test(prefix)) {
    prefix = `_${prefix}`;
  }
  return prefix;
}

function sortSessionsByStart(list) {
  list.sort((a, b) => {
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }
    return a.endMs - b.endMs;
  });
}

function rememberLatestDisplayName(map, userId, displayName, observedAtMs) {
  if (!userId || !displayName || Number.isNaN(observedAtMs)) {
    return;
  }
  const prev = map.get(userId);
  if (!prev || observedAtMs >= prev.observedAtMs) {
    map.set(userId, { displayName, observedAtMs });
  }
}

function findExistingTable(dbPath, expectedName, likePattern) {
  const exactRows = runSqlJson(
    dbPath,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${escapeSqlString(expectedName)}'`
  );
  if (exactRows[0]?.name) {
    return exactRows[0].name;
  }
  if (!likePattern) {
    return '';
  }
  return (
    runSqlJson(
      dbPath,
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${escapeSqlString(likePattern)}' ORDER BY name LIMIT 1`
    )[0]?.name || ''
  );
}

function extractWorldId(location) {
  return parseLocationDetails(location).worldId || '';
}

function upsertLocationMeta(locationMeta, location, meta = {}) {
  const key = String(location || '');
  if (!key) {
    return;
  }
  const prev = locationMeta.get(key) || {};
  locationMeta.set(key, {
    worldName: prev.worldName || meta.worldName || meta.worldId || key,
    groupName: prev.groupName || meta.groupName || '',
    worldId: prev.worldId || meta.worldId || extractWorldId(key)
  });
}

function isTrackableLocation(location) {
  const details = parseLocationDetails(location);
  return details.isRealInstance && Boolean(details.worldId) && Boolean(details.instanceId);
}

function pushRawSession(rawSessions, row, location, endMs, durationMs) {
  if (!isTrackableLocation(location) || Number.isNaN(endMs) || !(durationMs > 0)) {
    return;
  }
  const userId = row.userId || `name:${row.displayName || 'unknown'}`;
  const displayName = row.displayName || userId;
  rawSessions.push({
    userId,
    displayName,
    location,
    startMs: Math.max(0, endMs - durationMs),
    endMs,
    source: row.source || 'local'
  });
}

function mergeRawSessions(rawSessions) {
  const sorted = [...rawSessions].sort((a, b) => {
    if (a.userId !== b.userId) {
      return a.userId.localeCompare(b.userId);
    }
    if (a.location !== b.location) {
      return a.location.localeCompare(b.location);
    }
    if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }
    return a.endMs - b.endMs;
  });

  const merged = [];
  for (const row of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.userId === row.userId &&
      prev.location === row.location &&
      row.startMs <= prev.endMs &&
      (prev.source !== 'local' || row.source !== 'local')
    ) {
      if (row.endMs > prev.endMs) {
        prev.endMs = row.endMs;
      }
      if (!prev.displayName && row.displayName) {
        prev.displayName = row.displayName;
      }
      if (prev.source !== row.source) {
        prev.source = 'merged';
      }
      continue;
    }
    merged.push({ ...row });
  }

  return merged;
}

export function buildIndex(dbPath) {
  const cfgRows = runSqlJson(
    dbPath,
    "SELECT value FROM configs WHERE key = 'config:lastuserloggedin' LIMIT 1"
  );
  const selfUserId = cfgRows[0]?.value || '';
  if (!selfUserId) {
    throw new Error('cannot find config:lastuserloggedin in configs table');
  }

  const prefix = toUserPrefix(selfUserId);
  const expectedFriendTable = `${prefix}_friend_log_current`;
  const friendTable = findExistingTable(dbPath, expectedFriendTable, '%_friend_log_current');

  if (!friendTable) {
    throw new Error('cannot find *_friend_log_current table');
  }

  const feedGpsTable = findExistingTable(dbPath, `${prefix}_feed_gps`, '%_feed_gps');
  const feedOnlineOfflineTable = findExistingTable(
    dbPath,
    `${prefix}_feed_online_offline`,
    '%_feed_online_offline'
  );

  const friendRows = runSqlJson(
    dbPath,
    `SELECT user_id AS userId, display_name AS displayName, trust_level AS trustLevel FROM ${friendTable}`
  );

  const friendSet = new Set();
  const friendList = [];
  const currentDisplayNameMap = new Map();
  for (const row of friendRows) {
    if (!row.userId) continue;
    friendSet.add(row.userId);
    currentDisplayNameMap.set(row.userId, row.displayName || row.userId);
    friendList.push({
      userId: row.userId,
      displayName: row.displayName || row.userId,
      trustLevel: row.trustLevel || ''
    });
  }

  const locationRows = runSqlJson(
    dbPath,
    `SELECT location, world_name AS worldName, group_name AS groupName, world_id AS worldId, created_at AS createdAt
     FROM gamelog_location
     WHERE location IS NOT NULL AND location != ''
     ORDER BY created_at DESC`
  );

  const locationMeta = new Map();
  for (const row of locationRows) {
    upsertLocationMeta(locationMeta, row.location, {
      worldName: row.worldName,
      groupName: row.groupName,
      worldId: row.worldId
    });
  }

  const jlRows = runSqlJson(
    dbPath,
    `SELECT created_at AS createdAt, display_name AS displayName, user_id AS userId, location, time
     FROM gamelog_join_leave
     WHERE type = 'OnPlayerLeft' AND time > 0 AND location IS NOT NULL AND location != ''
     ORDER BY created_at ASC`
  );

  const feedGpsRows = feedGpsTable
    ? runSqlJson(
        dbPath,
        `SELECT created_at AS createdAt, user_id AS userId, display_name AS displayName, location,
                world_name AS worldName, previous_location AS previousLocation, time, group_name AS groupName
         FROM ${feedGpsTable}
         WHERE location IS NOT NULL AND location != ''
         ORDER BY created_at ASC`
      )
    : [];

  const feedOnlineOfflineRows = feedOnlineOfflineTable
    ? runSqlJson(
        dbPath,
        `SELECT created_at AS createdAt, user_id AS userId, display_name AS displayName, type, location,
                world_name AS worldName, time, group_name AS groupName
         FROM ${feedOnlineOfflineTable}
         WHERE location IS NOT NULL AND location != ''
           AND (type = 'Online' OR type = 'Offline')
         ORDER BY created_at ASC`
      )
    : [];

  for (const row of feedGpsRows) {
    upsertLocationMeta(locationMeta, row.location, {
      worldName: row.worldName,
      groupName: row.groupName
    });
  }
  for (const row of feedOnlineOfflineRows) {
    upsertLocationMeta(locationMeta, row.location, {
      worldName: row.worldName,
      groupName: row.groupName
    });
  }

  let observedUntilMs = 0;
  const allCreatedRows = [
    ...locationRows,
    ...jlRows,
    ...feedGpsRows,
    ...feedOnlineOfflineRows
  ];
  for (const row of allCreatedRows) {
    const createdAtMs = Date.parse(row.createdAt || '');
    if (!Number.isNaN(createdAtMs) && createdAtMs > observedUntilMs) {
      observedUntilMs = createdAtMs;
    }
  }

  const rawSessions = [];
  const latestObservedDisplayNames = new Map();

  for (const row of jlRows) {
    const endMs = Date.parse(row.createdAt || '');
    if (Number.isNaN(endMs)) {
      continue;
    }

    rememberLatestDisplayName(latestObservedDisplayNames, row.userId, row.displayName, endMs);
    const durationMs = Number(row.time || 0);
    pushRawSession(rawSessions, row, row.location, endMs, durationMs);
  }

  const openFeedSessions = new Map();
  const feedEvents = [];
  for (const row of feedOnlineOfflineRows) {
    feedEvents.push({
      kind: row.type,
      createdAt: row.createdAt,
      userId: row.userId,
      displayName: row.displayName,
      location: row.location,
      time: row.time,
      source: 'feed'
    });
  }
  for (const row of feedGpsRows) {
    feedEvents.push({
      kind: 'GPS',
      createdAt: row.createdAt,
      userId: row.userId,
      displayName: row.displayName,
      location: row.location,
      previousLocation: row.previousLocation,
      time: row.time,
      source: 'feed'
    });
  }

  feedEvents.sort((a, b) => {
    const left = Date.parse(a.createdAt || '');
    const right = Date.parse(b.createdAt || '');
    if (left !== right) {
      return left - right;
    }
    const order = { Online: 0, GPS: 1, Offline: 2 };
    return (order[a.kind] ?? 9) - (order[b.kind] ?? 9);
  });

  for (const row of feedEvents) {
    const createdAtMs = Date.parse(row.createdAt || '');
    if (Number.isNaN(createdAtMs)) {
      continue;
    }

    rememberLatestDisplayName(latestObservedDisplayNames, row.userId, row.displayName, createdAtMs);

    if (row.kind === 'GPS') {
      pushRawSession(rawSessions, row, row.previousLocation, createdAtMs, Number(row.time || 0));
      if (isTrackableLocation(row.location)) {
        openFeedSessions.set(row.userId, {
          userId: row.userId,
          displayName: row.displayName || row.userId,
          location: row.location,
          startMs: createdAtMs,
          source: 'feed'
        });
      } else {
        openFeedSessions.delete(row.userId);
      }
      continue;
    }

    if (row.kind === 'Offline') {
      pushRawSession(rawSessions, row, row.location, createdAtMs, Number(row.time || 0));
      openFeedSessions.delete(row.userId);
      continue;
    }

    if (row.kind === 'Online' && isTrackableLocation(row.location)) {
      openFeedSessions.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName || row.userId,
        location: row.location,
        startMs: createdAtMs
      });
    }
  }

  for (const row of openFeedSessions.values()) {
    if (observedUntilMs > row.startMs) {
      rawSessions.push({
        userId: row.userId,
        displayName: row.displayName,
        location: row.location,
        startMs: row.startMs,
        endMs: observedUntilMs,
        source: row.source || 'feed'
      });
    }
  }

  const mergedSessions = mergeRawSessions(rawSessions);
  const displayNameMap = new Map(
    Array.from(latestObservedDisplayNames.entries()).map(([userId, value]) => [userId, value.displayName])
  );
  for (const [userId, displayName] of currentDisplayNameMap.entries()) {
    displayNameMap.set(userId, displayName);
  }
  const sessions = [];
  const byUser = new Map();
  const byLocation = new Map();
  const locationDetailsByLocation = new Map();

  for (const row of mergedSessions) {
    const details = parseLocationDetails(row.location);
    locationDetailsByLocation.set(row.location, details);
    const meta = locationMeta.get(row.location) || {
      worldName: row.location,
      groupName: '',
      worldId: details.worldId || extractWorldId(row.location)
    };
    const session = {
      userId: row.userId,
      displayName: displayNameMap.get(row.userId) || row.displayName || row.userId,
      location: row.location,
      worldName: meta.worldName || row.location,
      groupName: meta.groupName || '',
      worldId: meta.worldId || details.worldId || extractWorldId(row.location),
      accessType: details.accessType,
      accessTypeName: details.accessTypeName,
      region: details.region,
      groupId: details.groupId,
      groupAccessType: details.groupAccessType,
      startMs: row.startMs,
      endMs: row.endMs,
      durationMs: Math.max(0, row.endMs - row.startMs),
      startAt: new Date(row.startMs).toISOString(),
      endAt: new Date(row.endMs).toISOString()
    };

    sessions.push(session);
    if (!displayNameMap.has(session.userId)) {
      displayNameMap.set(session.userId, session.displayName);
    }

    if (!byUser.has(session.userId)) {
      byUser.set(session.userId, []);
    }
    byUser.get(session.userId).push(session);

    if (!byLocation.has(session.location)) {
      byLocation.set(session.location, []);
    }
    byLocation.get(session.location).push(session);
  }

  for (const list of byUser.values()) {
    sortSessionsByStart(list);
  }
  for (const list of byLocation.values()) {
    sortSessionsByStart(list);
  }

  const peakByLocation = new Map();
  for (const [location, list] of byLocation.entries()) {
    peakByLocation.set(location, calculatePeakOccupancy(list));
  }

  if (!displayNameMap.has(selfUserId)) {
    displayNameMap.set(selfUserId, selfUserId);
  }

  return {
    dbPath,
    selfUserId,
    selfDisplayName: displayNameMap.get(selfUserId) || selfUserId,
    friendTable,
    friendSet,
    friendList: friendList.sort((a, b) => a.displayName.localeCompare(b.displayName)),
    displayNameMap,
    locationMeta,
    locationDetailsByLocation,
    sessions,
    byUser,
    byLocation,
    peakByLocation,
    loadedAt: new Date().toISOString()
  };
}
