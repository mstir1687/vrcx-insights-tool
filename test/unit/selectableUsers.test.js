import { describe, expect, test } from 'vitest';

import { buildSelectableUserOptions } from '../../src/static/selectableUsers.js';

describe('selectable user options', () => {
  test('includes jumped acquaintance users with display names in selector options', () => {
    const options = buildSelectableUserOptions(
      {
        selfUserId: 'usr_self',
        selfDisplayName: 'Self',
        friends: [{ userId: 'usr_friend', displayName: 'Friend' }]
      },
      [{ userId: 'usr_guest', displayName: 'Guest User' }]
    );

    expect(options).toEqual([
      { userId: 'usr_self', displayName: '我 - Self' },
      { userId: 'usr_friend', displayName: 'Friend' },
      { userId: 'usr_guest', displayName: 'Guest User' }
    ]);
  });

  test('deduplicates repeated users by userId', () => {
    const options = buildSelectableUserOptions(
      {
        selfUserId: 'usr_self',
        selfDisplayName: 'Self',
        friends: [{ userId: 'usr_friend', displayName: 'Friend' }]
      },
      [
        { userId: 'usr_friend', displayName: 'Friend Override' },
        { userId: 'usr_guest', displayName: 'Guest User' },
        { userId: 'usr_guest', displayName: 'Guest User 2' }
      ]
    );

    expect(options).toEqual([
      { userId: 'usr_self', displayName: '我 - Self' },
      { userId: 'usr_friend', displayName: 'Friend' },
      { userId: 'usr_guest', displayName: 'Guest User' }
    ]);
  });
});
