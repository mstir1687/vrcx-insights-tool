import { describe, expect, test } from 'vitest';

import {
  getDisplayNameLabel,
  getDisplayNameTooltip,
  getWorldLabel,
  getWorldTooltip
} from '../../src/static/hiddenIdentifiers.js';

describe('hidden identifier helpers', () => {
  test('uses display name as visible user label', () => {
    expect(getDisplayNameLabel({ displayName: 'Alice', userId: 'usr_123' })).toBe('Alice');
  });

  test('uses user id as tooltip when a display name exists', () => {
    expect(getDisplayNameTooltip({ displayName: 'Alice', userId: 'usr_123' })).toBe('usr_123');
    expect(getDisplayNameTooltip({ displayName: '', userId: 'usr_123' })).toBe('');
  });

  test('uses world name as visible label and location as tooltip', () => {
    expect(getWorldLabel({ worldName: 'World A', location: 'wrld_1:123~hidden' })).toBe('World A');
    expect(getWorldTooltip({ worldName: 'World A', location: 'wrld_1:123~hidden' })).toBe('wrld_1:123~hidden');
  });
});
