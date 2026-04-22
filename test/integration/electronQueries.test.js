import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { describe, expect, test } from 'vitest';

import { InsightsService } from '../../src/analyzer/insightsService.js';
import {
  runAcquaintancesQuery,
  runMetaQuery,
  runRelationshipPairQuery,
  runRelationshipTopQuery,
  runTimelineQuery
} from '../../src/queries/insightsQueries.js';
import { createFixtureDb } from '../fixtures/createFixtureDb.js';

function createService(dbPath) {
  const service = new InsightsService(dbPath);
  service.reload();
  return service;
}

describe('electron query integration', () => {
  test('exposes required data fields through direct desktop queries', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture.sqlite3');
    createFixtureDb(dbPath);

    const service = createService(dbPath);

    const meta = runMetaQuery(service);
    expect(meta.selfUserId).toBe('usr_self');

    const acquaintances = runAcquaintancesQuery(service, { from: '2026-04-01', to: '2026-04-30' });
    expect(Array.isArray(acquaintances.byMeetCount)).toBe(true);
    expect(Array.isArray(acquaintances.byOverlap)).toBe(true);

    const timeline = runTimelineQuery(service, { userId: 'usr_self' });
    expect(Array.isArray(timeline.sessions)).toBe(true);
    expect(Array.isArray(timeline.companions)).toBe(true);
    if (timeline.sessions.length > 0) {
      const row = timeline.sessions[0];
      expect(row).toHaveProperty('accessType');
      expect(row).toHaveProperty('accessTypeName');
      expect(row).toHaveProperty('region');
    }

    const top = runRelationshipTopQuery(service, { userId: 'usr_friend_a' });
    expect(Array.isArray(top.rows)).toBe(true);

    const pair = runRelationshipPairQuery(service, { userIdA: 'usr_friend_a', userIdB: 'usr_friend_b' });
    expect(Array.isArray(pair.records)).toBe(true);
    if (pair.records.length > 0) {
      const row = pair.records[0];
      expect(row).toHaveProperty('peakOccupancy');
      expect(row).toHaveProperty('selfPresent');
      expect(row).toHaveProperty('hostType');
      expect(row).toHaveProperty('accessType');
      expect(row).toHaveProperty('accessTypeName');
      expect(row).toHaveProperty('region');
    }
  });

  test('includes invite and invite+ instances instead of filtering private-tagged real instances', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-invite.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      INSERT INTO gamelog_location (created_at, location, world_id, world_name, time, group_name) VALUES
        ('2026-04-16T10:00:00.000Z', 'wrld_invite:101~private(usr_host)~region(eu)', 'wrld_invite', 'Invite World', 1800000, ''),
        ('2026-04-16T12:00:00.000Z', 'wrld_invite_plus:102~private(usr_host)~canRequestInvite~region(us)', 'wrld_invite_plus', 'Invite Plus World', 1800000, '');

      INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time) VALUES
        ('2026-04-16T10:30:00.000Z', 'OnPlayerLeft', 'Self', 'wrld_invite:101~private(usr_host)~region(eu)', 'usr_self', 1800000),
        ('2026-04-16T10:30:00.000Z', 'OnPlayerLeft', 'Friend A', 'wrld_invite:101~private(usr_host)~region(eu)', 'usr_friend_a', 1200000),
        ('2026-04-16T12:30:00.000Z', 'OnPlayerLeft', 'Self', 'wrld_invite_plus:102~private(usr_host)~canRequestInvite~region(us)', 'usr_self', 1800000),
        ('2026-04-16T12:30:00.000Z', 'OnPlayerLeft', 'Friend A', 'wrld_invite_plus:102~private(usr_host)~canRequestInvite~region(us)', 'usr_friend_a', 900000);
      `
    ]);

    const service = createService(dbPath);

    const timeline = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-04-16',
      to: '2026-04-17'
    });

    expect(
      timeline.sessions.some(
        (row) =>
          row.location === 'wrld_invite:101~private(usr_host)~region(eu)' &&
          row.accessType === 'invite' &&
          row.accessTypeName === 'invite' &&
          row.region === 'eu'
      )
    ).toBe(true);
    expect(
      timeline.sessions.some(
        (row) =>
          row.location === 'wrld_invite_plus:102~private(usr_host)~canRequestInvite~region(us)' &&
          row.accessType === 'invite+' &&
          row.accessTypeName === 'invite+' &&
          row.region === 'us'
      )
    ).toBe(true);

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_self',
      userIdB: 'usr_friend_a',
      from: '2026-04-16',
      to: '2026-04-17'
    });

    expect(
      pair.records.some(
        (row) =>
          row.location === 'wrld_invite:101~private(usr_host)~region(eu)' &&
          row.accessType === 'invite' &&
          row.region === 'eu'
      )
    ).toBe(true);
    expect(
      pair.records.some(
        (row) =>
          row.location === 'wrld_invite_plus:102~private(usr_host)~canRequestInvite~region(us)' &&
          row.accessType === 'invite+' &&
          row.region === 'us'
      )
    ).toBe(true);
  });

  test('prefers the current friend display name over historical log names', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-current-display-name.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      UPDATE usrself_friend_log_current
      SET display_name = 'dango_remilia'
      WHERE user_id = 'usr_friend_a';

      UPDATE gamelog_join_leave
      SET display_name = 'レミだんご'
      WHERE user_id = 'usr_friend_a';
      `
    ]);

    const service = createService(dbPath);

    const meta = runMetaQuery(service);
    expect(meta.friends.find((row) => row.userId === 'usr_friend_a')?.displayName).toBe(
      'dango_remilia'
    );

    const timeline = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-04-01',
      to: '2026-04-30'
    });
    expect(timeline.companions.find((row) => row.userId === 'usr_friend_a')?.displayName).toBe(
      'dango_remilia'
    );

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_self',
      userIdB: 'usr_friend_a',
      from: '2026-04-01',
      to: '2026-04-30'
    });
    expect(pair.displayNameB).toBe('dango_remilia');
  });

  test('timeline changes with time range and is not capped to 300 by default', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-large.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      WITH RECURSIVE seq(x) AS (
        SELECT 0
        UNION ALL
        SELECT x + 1 FROM seq WHERE x < 399
      )
      INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time)
      SELECT
        strftime('%Y-%m-%dT%H:%M:%fZ', '2026-04-15 00:00:00', '+' || x || ' minutes'),
        'OnPlayerLeft',
        'Self',
        'wrld_1:100~hidden(usr_host)~region(jp)',
        'usr_self',
        600000
      FROM seq;
      `
    ]);

    const service = createService(dbPath);

    const full = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-04-01',
      to: '2026-04-30'
    });
    expect(full.sessions.length).toBeGreaterThan(300);

    const capped = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-04-01',
      to: '2026-04-30',
      sessionLimit: 50
    });
    expect(capped.sessions.length).toBe(50);
  });

  test('supports backend pagination for combined and single-table endpoints', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-paginated.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      WITH RECURSIVE seq(x) AS (
        SELECT 0
        UNION ALL
        SELECT x + 1 FROM seq WHERE x < 59
      )
      INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time)
      SELECT
        strftime('%Y-%m-%dT%H:%M:%fZ', '2026-04-10 00:00:00', '+' || x || ' minutes'),
        'OnPlayerLeft',
        'Self',
        'wrld_1:100~hidden(usr_host)~region(jp)',
        'usr_self',
        600000
      FROM seq;
      `
    ]);

    const service = createService(dbPath);

    const acquaintances = runAcquaintancesQuery(service, {
      from: '2026-04-01',
      to: '2026-04-30',
      page: 1,
      pageSize: 3
    });
    expect(acquaintances.byMeetCount.length).toBeLessThanOrEqual(3);
    expect(acquaintances.byMeetCountTotal).toBeGreaterThanOrEqual(acquaintances.byMeetCount.length);
    expect(acquaintances.byOverlap.length).toBeLessThanOrEqual(3);
    expect(acquaintances.byOverlapTotal).toBeGreaterThanOrEqual(acquaintances.byOverlap.length);
    expect(acquaintances.page).toBe(1);
    expect(acquaintances.pageSize).toBe(3);

    const timeline = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-04-01',
      to: '2026-04-30',
      page: 2,
      pageSize: 5
    });
    expect(timeline.sessions.length).toBeLessThanOrEqual(5);
    expect(timeline.sessionsTotal).toBeGreaterThan(5);
    expect(timeline.page).toBe(2);
    expect(timeline.companions.length).toBeLessThanOrEqual(5);
    expect(timeline.companionsTotal).toBeGreaterThanOrEqual(timeline.companions.length);

    const top = runRelationshipTopQuery(service, {
      userId: 'usr_friend_a',
      page: 1,
      pageSize: 2,
      scope: 'all'
    });
    expect(top.rows.length).toBeLessThanOrEqual(2);
    expect(top.total).toBeGreaterThanOrEqual(top.rows.length);

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_friend_a',
      userIdB: 'usr_friend_b',
      page: 1,
      pageSize: 1
    });
    expect(pair.records.length).toBeLessThanOrEqual(1);
    expect(pair.total).toBeGreaterThanOrEqual(pair.records.length);
  });

  test('timeline pagination metadata follows the requested scope instead of the larger sibling table', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-timeline-scope.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      WITH RECURSIVE sessions(x) AS (
        SELECT 0
        UNION ALL
        SELECT x + 1 FROM sessions WHERE x < 2
      )
      INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time)
      SELECT
        strftime('%Y-%m-%dT%H:%M:%fZ', '2026-05-01 10:00:00', '+' || (x * 30) || ' minutes'),
        'OnPlayerLeft',
        'Self',
        'wrld_scope:' || x || '~hidden(usr_host)~region(jp)',
        'usr_self',
        1800000
      FROM sessions;

      WITH RECURSIVE companions(x) AS (
        SELECT 0
        UNION ALL
        SELECT x + 1 FROM companions WHERE x < 24
      )
      INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time)
      SELECT
        strftime('%Y-%m-%dT%H:%M:%fZ', '2026-05-01 10:05:00', '+' || ((x % 3) * 30) || ' minutes'),
        'OnPlayerLeft',
        'Companion ' || x,
        'wrld_scope:' || (x % 3) || '~hidden(usr_host)~region(jp)',
        'usr_scope_' || x,
        1200000
      FROM companions;
      `
    ]);

    const service = createService(dbPath);

    const sessionsScope = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-05-01',
      to: '2026-05-02',
      page: 1,
      pageSize: 10
    });

    expect(sessionsScope.sessionsTotal).toBe(3);
    expect(sessionsScope.companionsTotal).toBe(25);
    expect(sessionsScope.total).toBe(3);
    expect(sessionsScope.totalPages).toBe(1);

    const companionsScope = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-05-01',
      to: '2026-05-02',
      page: 1,
      pageSize: 10,
      scope: 'companions'
    });

    expect(companionsScope.total).toBe(25);
    expect(companionsScope.totalPages).toBe(3);
  });

  test('includes friend feed GPS sessions in pair and companion analysis', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-feed-gps.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      INSERT INTO usrself_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES
        ('2026-04-12T10:00:00.000Z', 'usr_friend_a', 'Friend A', 'Online', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 'Feed World', '', ''),
        ('2026-04-12T10:10:00.000Z', 'usr_friend_b', 'Friend B', 'Online', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 'Feed World', '', '');

      INSERT INTO usrself_feed_gps (created_at, user_id, display_name, location, world_name, previous_location, time, group_name) VALUES
        ('2026-04-12T11:00:00.000Z', 'usr_friend_a', 'Friend A', 'wrld_next:a~hidden(usr_host)~region(jp)', 'Next World', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 3600000, ''),
        ('2026-04-12T11:10:00.000Z', 'usr_friend_b', 'Friend B', 'wrld_next:b~hidden(usr_host)~region(jp)', 'Next World', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 3600000, '');
      `
    ]);

    const service = createService(dbPath);

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_friend_a',
      userIdB: 'usr_friend_b',
      from: '2026-04-12',
      to: '2026-04-13'
    });

    expect(pair.records).toHaveLength(1);
    expect(pair.records[0].location).toBe('wrld_feed:alpha~hidden(usr_host)~region(jp)');
    expect(pair.records[0].overlapMs).toBe(3000000);
    expect(pair.records[0].selfPresent).toBe(false);

    const timeline = runTimelineQuery(service, {
      userId: 'usr_friend_a',
      from: '2026-04-12',
      to: '2026-04-13'
    });

    expect(timeline.companions.some((row) => row.userId === 'usr_friend_b' && row.overlapMs === 3000000)).toBe(true);

    const top = runRelationshipTopQuery(service, {
      userId: 'usr_friend_a',
      scope: 'all',
      from: '2026-04-12',
      to: '2026-04-13'
    });

    expect(top.rows.some((row) => row.userId === 'usr_friend_b' && row.overlapMs === 3000000)).toBe(true);
  });

  test('sums local and feed overlap in relationship top the same way as pair analysis', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-relationship-top-merged.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      INSERT INTO usrself_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES
        ('2026-04-12T10:00:00.000Z', 'usr_friend_a', 'Friend A', 'Online', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 'Feed World', '', ''),
        ('2026-04-12T10:10:00.000Z', 'usr_friend_b', 'Friend B', 'Online', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 'Feed World', '', '');

      INSERT INTO usrself_feed_gps (created_at, user_id, display_name, location, world_name, previous_location, time, group_name) VALUES
        ('2026-04-12T11:00:00.000Z', 'usr_friend_a', 'Friend A', 'wrld_next:a~hidden(usr_host)~region(jp)', 'Next World', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 3600000, ''),
        ('2026-04-12T11:10:00.000Z', 'usr_friend_b', 'Friend B', 'wrld_next:b~hidden(usr_host)~region(jp)', 'Next World', 'wrld_feed:alpha~hidden(usr_host)~region(jp)', 3600000, '');
      `
    ]);

    const service = createService(dbPath);

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_friend_a',
      userIdB: 'usr_friend_b',
      from: '2026-04-10',
      to: '2026-04-13'
    });

    expect(pair.totalOverlapMs).toBe(4800000);
    expect(pair.records).toHaveLength(2);

    const top = runRelationshipTopQuery(service, {
      userId: 'usr_friend_a',
      scope: 'friends',
      from: '2026-04-10',
      to: '2026-04-13'
    });

    expect(top.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'usr_friend_b',
          overlapMs: pair.totalOverlapMs,
          meetCount: pair.records.length
        })
      ])
    );
  });

  test('caps open-ended friend feed sessions at last observed timestamp when VRCX stops recording', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-feed-cap.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      INSERT INTO usrself_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES
        ('2026-04-13T10:00:00.000Z', 'usr_friend_a', 'Friend A', 'Online', 'wrld_cap:room~hidden(usr_host)~region(jp)', 'Cap World', '', ''),
        ('2026-04-13T10:30:00.000Z', 'usr_friend_b', 'Friend B', 'Online', 'wrld_cap:room~hidden(usr_host)~region(jp)', 'Cap World', '', ''),
        ('2026-04-13T11:00:00.000Z', 'usr_stranger', 'Stranger', 'Online', 'wrld_elsewhere:1~hidden(usr_host)~region(jp)', 'Elsewhere', '', '');
      `
    ]);

    const service = createService(dbPath);

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_friend_a',
      userIdB: 'usr_friend_b',
      from: '2026-04-13',
      to: '2026-04-30'
    });

    expect(pair.records).toHaveLength(1);
    expect(pair.records[0].overlapMs).toBe(1800000);
  });

  test('keeps invite instances in analysis sessions', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-private.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      INSERT INTO gamelog_location (created_at, location, world_id, world_name, time, group_name) VALUES
        ('2026-04-14T10:00:00.000Z', 'wrld_private:42~private(usr_host)', 'wrld_private', 'Private World', 1800000, '');

      INSERT INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time) VALUES
        ('2026-04-14T10:30:00.000Z', 'OnPlayerLeft', 'Self', 'wrld_private:42~private(usr_host)', 'usr_self', 1800000),
        ('2026-04-14T10:30:00.000Z', 'OnPlayerLeft', 'Friend A', 'wrld_private:42~private(usr_host)', 'usr_friend_a', 1800000),
        ('2026-04-14T10:30:00.000Z', 'OnPlayerLeft', 'Friend B', 'wrld_private:42~private(usr_host)', 'usr_friend_b', 1800000);
      `
    ]);

    const service = createService(dbPath);

    const timeline = runTimelineQuery(service, {
      userId: 'usr_self',
      from: '2026-04-14',
      to: '2026-04-15'
    });

    expect(timeline.sessions).toHaveLength(1);
    expect(timeline.sessions[0]).toMatchObject({
      location: 'wrld_private:42~private(usr_host)',
      accessType: 'invite',
      accessTypeName: 'invite',
      region: 'us'
    });

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_friend_a',
      userIdB: 'usr_friend_b',
      from: '2026-04-14',
      to: '2026-04-15'
    });

    expect(pair.records).toHaveLength(1);
    expect(pair.records[0]).toMatchObject({
      location: 'wrld_private:42~private(usr_host)',
      accessType: 'invite',
      accessTypeName: 'invite',
      region: 'us'
    });
  });

  test('excludes literal private location placeholders from analysis sessions', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrcx-insights-'));
    const dbPath = path.join(tempDir, 'fixture-literal-private.sqlite3');
    createFixtureDb(dbPath);

    execFileSync('sqlite3', [
      dbPath,
      `
      INSERT INTO usrself_feed_online_offline (created_at, user_id, display_name, type, location, world_name, time, group_name) VALUES
        ('2026-04-15T10:00:00.000Z', 'usr_friend_a', 'Friend A', 'Online', 'private', 'private', '', ''),
        ('2026-04-15T10:10:00.000Z', 'usr_friend_b', 'Friend B', 'Online', 'private', 'private', '', ''),
        ('2026-04-15T11:00:00.000Z', 'usr_stranger', 'Stranger', 'Online', 'wrld_elsewhere:1~hidden(usr_host)', 'Elsewhere', '', '');
      `
    ]);

    const service = createService(dbPath);

    const timeline = runTimelineQuery(service, {
      userId: 'usr_friend_a',
      from: '2026-04-15',
      to: '2026-04-16'
    });

    expect(timeline.sessions).toHaveLength(0);

    const pair = runRelationshipPairQuery(service, {
      userIdA: 'usr_friend_a',
      userIdB: 'usr_friend_b',
      from: '2026-04-15',
      to: '2026-04-16'
    });

    expect(pair.records).toHaveLength(0);
  });
});
