import { describe, expect, test } from 'vitest';

import { toDateRangeMs } from '../../src/analyzer/dateRange.js';

describe('date range parser', () => {
  test('parses local date boundaries', () => {
    const { fromMs, toMs } = toDateRangeMs({ from: '2026-04-01', to: '2026-04-01' });
    expect(toMs - fromMs).toBe(24 * 60 * 60 * 1000);
  });

  test('returns null bounds when missing filters', () => {
    const { fromMs, toMs } = toDateRangeMs({});
    expect(fromMs).toBeNull();
    expect(toMs).toBeNull();
  });
});
