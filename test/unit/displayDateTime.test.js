import { describe, expect, test } from 'vitest';

import { formatDisplayDateTime } from '../../src/static/datetime.js';

describe('formatDisplayDateTime', () => {
  test('formats ISO timestamps as YYYY-MM-DD HH:mm:ss', () => {
    expect(formatDisplayDateTime('2026-04-19T15:53:20.000Z')).toBe('2026-04-19 15:53:20');
  });

  test('falls back to the original value for invalid timestamps', () => {
    expect(formatDisplayDateTime('not-a-date')).toBe('not-a-date');
  });
});
