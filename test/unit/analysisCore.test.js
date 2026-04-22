import { describe, expect, test } from 'vitest';

import {
  calculateOverlapMs,
  collectOverlapSegments,
  calculatePeakOccupancy,
  isSelfPresentInSegments
} from '../../src/analyzer/overlap.js';
import { parseLocationHost } from '../../src/analyzer/locationHost.js';

describe('overlap core', () => {
  test('calculates overlap duration with two pointers', () => {
    const a = [
      { startMs: 1000, endMs: 5000 },
      { startMs: 7000, endMs: 10000 }
    ];
    const b = [
      { startMs: 2000, endMs: 3500 },
      { startMs: 8000, endMs: 12000 }
    ];

    const ms = calculateOverlapMs(a, b);
    expect(ms).toBe(1500 + 2000);
  });

  test('collects overlap segments grouped by intersections', () => {
    const a = [{ startMs: 1000, endMs: 6000 }];
    const b = [
      { startMs: 2000, endMs: 2500 },
      { startMs: 3000, endMs: 5000 }
    ];

    const segments = collectOverlapSegments(a, b);
    expect(segments).toEqual([
      { startMs: 2000, endMs: 2500, overlapMs: 500 },
      { startMs: 3000, endMs: 5000, overlapMs: 2000 }
    ]);
  });

  test('calculates location peak occupancy via sweep line', () => {
    const sessions = [
      { userId: 'u1', startMs: 1000, endMs: 5000 },
      { userId: 'u2', startMs: 2000, endMs: 4000 },
      { userId: 'u3', startMs: 3000, endMs: 7000 }
    ];
    expect(calculatePeakOccupancy(sessions)).toBe(3);
  });

  test('checks self presence in overlap segments', () => {
    const selfSessions = [{ startMs: 3500, endMs: 4500 }];
    const segments = [{ startMs: 3000, endMs: 4000, overlapMs: 1000 }];
    expect(isSelfPresentInSegments(selfSessions, segments)).toBe(true);
  });
});

describe('location host parser', () => {
  test('parses hidden host from location tag', () => {
    const host = parseLocationHost(
      'wrld_x:12345~hidden(usr_host)~region(jp)',
      new Map([['usr_host', 'HostUser']])
    );
    expect(host).toEqual({
      hostType: 'hidden',
      hostUserId: 'usr_host',
      hostDisplayName: 'HostUser',
      groupId: null
    });
  });

  test('returns group host metadata for group instance', () => {
    const host = parseLocationHost('wrld_x:12345~group(grp_abc)~groupAccessType(plus)');
    expect(host).toEqual({
      hostType: 'group',
      hostUserId: null,
      hostDisplayName: null,
      groupId: 'grp_abc'
    });
  });
});
