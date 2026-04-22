import { buildIndex } from './indexBuilder.js';
import { clipSessionToRange, sessionIntersectsRange, toDateRangeMs } from './dateRange.js';
import {
  calculateOverlapMs,
  calculatePeakOccupancy,
  collectOverlapSegments,
  isSelfPresentInSegments
} from './overlap.js';
import { parseLocationHost } from './locationHost.js';

function groupByLocation(sessions) {
  const map = new Map();
  for (const session of sessions) {
    if (!map.has(session.location)) {
      map.set(session.location, []);
    }
    map.get(session.location).push(session);
  }
  return map;
}

function sumOverlapMs(segments) {
  return segments.reduce((sum, item) => sum + item.overlapMs, 0);
}

function summarizeLocationOverlap(listA, listB) {
  const segments = collectOverlapSegments(listA, listB);
  if (segments.length === 0) {
    return null;
  }
  return {
    segments,
    overlapMs: sumOverlapMs(segments),
    overlapStartMs: Math.min(...segments.map((item) => item.startMs)),
    overlapEndMs: Math.max(...segments.map((item) => item.endMs))
  };
}

export class InsightsService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.index = null;
  }

  reload() {
    this.index = buildIndex(this.dbPath);
    return this.getMeta();
  }

  ensureReady() {
    if (!this.index) {
      this.reload();
    }
  }

  getMeta() {
    this.ensureReady();
    const idx = this.index;
    return {
      dbPath: idx.dbPath,
      loadedAt: idx.loadedAt,
      selfUserId: idx.selfUserId,
      selfDisplayName: idx.selfDisplayName,
      friendTable: idx.friendTable,
      friendCount: idx.friendList.length,
      sessionCount: idx.sessions.length,
      userCount: idx.byUser.size,
      locationCount: idx.byLocation.size,
      friends: idx.friendList
    };
  }

  getFilteredUserSessions(userId, fromMs, toMs) {
    this.ensureReady();
    const base = this.index.byUser.get(userId) || [];
    const filtered = [];
    for (const session of base) {
      if (!sessionIntersectsRange(session, fromMs, toMs)) {
        continue;
      }
      const clipped = clipSessionToRange(session, fromMs, toMs);
      if (clipped) {
        filtered.push(clipped);
      }
    }
    return filtered;
  }

  getAcquaintances({ from, to, limit = 50 } = {}) {
    this.ensureReady();
    const idx = this.index;
    const { fromMs, toMs } = toDateRangeMs({ from, to });

    const selfSessions = this.getFilteredUserSessions(idx.selfUserId, fromMs, toMs);
    const selfByLocation = groupByLocation(selfSessions);

    const agg = new Map();

    for (const [location, mySessions] of selfByLocation.entries()) {
      const locationSessions = (idx.byLocation.get(location) || []).filter((item) =>
        sessionIntersectsRange(item, fromMs, toMs)
      );
      const byOther = new Map();
      for (const row of locationSessions) {
        if (row.userId === idx.selfUserId) continue;
        if (idx.friendSet.has(row.userId)) continue;
        if (!byOther.has(row.userId)) {
          byOther.set(row.userId, []);
        }
        const clipped = clipSessionToRange(row, fromMs, toMs);
        if (clipped) {
          byOther.get(row.userId).push(clipped);
        }
      }

      for (const [userId, sessions] of byOther.entries()) {
        const overlapMs = calculateOverlapMs(mySessions, sessions);
        if (overlapMs <= 0) continue;

        const prev = agg.get(userId) || {
          userId,
          displayName: idx.displayNameMap.get(userId) || userId,
          meetCount: 0,
          overlapMs: 0
        };
        prev.meetCount += 1;
        prev.overlapMs += overlapMs;
        agg.set(userId, prev);
      }
    }

    const rows = Array.from(agg.values());
    const byMeetCount = [...rows]
      .sort((a, b) => b.meetCount - a.meetCount || b.overlapMs - a.overlapMs)
      .slice(0, limit);
    const byOverlap = [...rows]
      .sort((a, b) => b.overlapMs - a.overlapMs || b.meetCount - a.meetCount)
      .slice(0, limit);

    return {
      range: { from, to },
      byMeetCount,
      byOverlap
    };
  }

  getTimeline({ userId, from, to, sessionLimit = null, companionLimit = 200 } = {}) {
    this.ensureReady();
    const idx = this.index;
    const targetUserId = userId || idx.selfUserId;
    const { fromMs, toMs } = toDateRangeMs({ from, to });

    const sessions = this.getFilteredUserSessions(targetUserId, fromMs, toMs).sort((a, b) => b.startMs - a.startMs);
    const targetByLocation = groupByLocation(sessions);

    const companionAgg = new Map();

    for (const [location, targetSessions] of targetByLocation.entries()) {
      const locationSessions = (idx.byLocation.get(location) || []).filter(
        (item) => item.userId !== targetUserId && sessionIntersectsRange(item, fromMs, toMs)
      );
      const byUser = new Map();
      for (const item of locationSessions) {
        const clipped = clipSessionToRange(item, fromMs, toMs);
        if (!clipped) continue;
        if (!byUser.has(item.userId)) {
          byUser.set(item.userId, []);
        }
        byUser.get(item.userId).push(clipped);
      }

      for (const [otherId, otherSessions] of byUser.entries()) {
        const overlapMs = calculateOverlapMs(targetSessions, otherSessions);
        if (overlapMs <= 0) continue;
        const prev = companionAgg.get(otherId) || {
          userId: otherId,
          displayName: idx.displayNameMap.get(otherId) || otherId,
          overlapMs: 0,
          meetCount: 0
        };
        prev.overlapMs += overlapMs;
        prev.meetCount += 1;
        companionAgg.set(otherId, prev);
      }
    }

    const companions = Array.from(companionAgg.values())
      .sort((a, b) => b.overlapMs - a.overlapMs || b.meetCount - a.meetCount)
      .slice(0, companionLimit);

    const timelineSessions =
      typeof sessionLimit === 'number' && sessionLimit > 0
        ? sessions.slice(0, sessionLimit)
        : sessions;

    return {
      targetUserId,
      targetDisplayName: idx.displayNameMap.get(targetUserId) || targetUserId,
      sessions: timelineSessions,
      companions
    };
  }

  getRelationshipTop({ userId, scope = 'friends', from, to, limit = 100 } = {}) {
    this.ensureReady();
    const idx = this.index;
    if (!userId) {
      throw new Error('userId is required');
    }

    const { fromMs, toMs } = toDateRangeMs({ from, to });
    const targetSessions = this.getFilteredUserSessions(userId, fromMs, toMs);
    const targetByLocation = groupByLocation(targetSessions);

    const friendsOnly = scope !== 'all';

    const agg = new Map();
    for (const [location, targetLocSessions] of targetByLocation.entries()) {
      const locationSessions = (idx.byLocation.get(location) || []).filter(
        (item) => item.userId !== userId && sessionIntersectsRange(item, fromMs, toMs)
      );

      const byUser = new Map();
      for (const session of locationSessions) {
        if (session.userId === idx.selfUserId) {
          continue;
        }
        if (friendsOnly && !idx.friendSet.has(session.userId)) {
          continue;
        }
        const clipped = clipSessionToRange(session, fromMs, toMs);
        if (!clipped) continue;
        if (!byUser.has(session.userId)) {
          byUser.set(session.userId, []);
        }
        byUser.get(session.userId).push(clipped);
      }

      for (const [otherId, otherSessions] of byUser.entries()) {
        const summary = summarizeLocationOverlap(targetLocSessions, otherSessions);
        if (!summary) continue;
        const prev = agg.get(otherId) || {
          userId: otherId,
          displayName: idx.displayNameMap.get(otherId) || otherId,
          overlapMs: 0,
          meetCount: 0,
          isFriend: idx.friendSet.has(otherId)
        };
        prev.overlapMs += summary.overlapMs;
        prev.meetCount += 1;
        agg.set(otherId, prev);
      }
    }

    const rows = Array.from(agg.values())
      .sort((a, b) => b.overlapMs - a.overlapMs || b.meetCount - a.meetCount)
      .slice(0, limit);

    return {
      userId,
      scope: friendsOnly ? 'friends' : 'all',
      rows
    };
  }

  getRelationshipPair({ userIdA, userIdB, from, to } = {}) {
    this.ensureReady();
    const idx = this.index;
    if (!userIdA || !userIdB) {
      throw new Error('userIdA and userIdB are required');
    }

    const { fromMs, toMs } = toDateRangeMs({ from, to });
    const sessionsA = this.getFilteredUserSessions(userIdA, fromMs, toMs);
    const sessionsB = this.getFilteredUserSessions(userIdB, fromMs, toMs);

    const aByLocation = groupByLocation(sessionsA);
    const bByLocation = groupByLocation(sessionsB);

    const selfSessions =
      idx.selfUserId === userIdA || idx.selfUserId === userIdB
        ? []
        : this.getFilteredUserSessions(idx.selfUserId, fromMs, toMs);
    const selfByLocation = groupByLocation(selfSessions);

    const records = [];

    for (const [location, aLoc] of aByLocation.entries()) {
      const bLoc = bByLocation.get(location);
      if (!bLoc || bLoc.length === 0) {
        continue;
      }

      const summary = summarizeLocationOverlap(aLoc, bLoc);
      if (!summary) {
        continue;
      }

      const locationSessions = (idx.byLocation.get(location) || []).filter((item) =>
        sessionIntersectsRange(item, fromMs, toMs)
      );
      const peakOccupancy = calculatePeakOccupancy(locationSessions);
      const host = parseLocationHost(location, idx.displayNameMap);

      const selfPresent =
        idx.selfUserId === userIdA ||
        idx.selfUserId === userIdB ||
        isSelfPresentInSegments(selfByLocation.get(location) || [], summary.segments);

      const meta = idx.locationMeta.get(location) || {
        worldName: location,
        groupName: '',
        worldId: ''
      };
      const details = idx.locationDetailsByLocation.get(location) || {
        accessType: '',
        accessTypeName: '',
        region: '',
        groupId: null,
        groupAccessType: null
      };

      records.push({
        location,
        worldId: meta.worldId || '',
        worldName: meta.worldName || location,
        groupName: meta.groupName || '',
        accessType: details.accessType,
        accessTypeName: details.accessTypeName,
        region: details.region,
        groupId: details.groupId,
        groupAccessType: details.groupAccessType,
        overlapMs: summary.overlapMs,
        overlapStartAt: new Date(summary.overlapStartMs).toISOString(),
        overlapEndAt: new Date(summary.overlapEndMs).toISOString(),
        peakOccupancy,
        selfPresent,
        ...host,
        segments: summary.segments.map((item) => ({
          overlapMs: item.overlapMs,
          startAt: new Date(item.startMs).toISOString(),
          endAt: new Date(item.endMs).toISOString()
        }))
      });
    }

    records.sort((a, b) => b.overlapMs - a.overlapMs || a.location.localeCompare(b.location));

    return {
      userIdA,
      userIdB,
      displayNameA: idx.displayNameMap.get(userIdA) || userIdA,
      displayNameB: idx.displayNameMap.get(userIdB) || userIdB,
      totalOverlapMs: records.reduce((sum, row) => sum + row.overlapMs, 0),
      records
    };
  }
}
