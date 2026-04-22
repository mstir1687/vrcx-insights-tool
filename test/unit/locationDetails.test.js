import { describe, expect, test } from 'vitest';

import { parseLocationDetails } from '../../src/analyzer/locationDetails.js';

describe('location details parser', () => {
  test('parses invite and invite+ using VRCX semantics', () => {
    expect(parseLocationDetails('wrld_abc:12345~private(usr_owner)~region(eu)')).toMatchObject({
      isRealInstance: true,
      accessType: 'invite',
      accessTypeName: 'invite',
      userId: 'usr_owner',
      region: 'eu'
    });

    expect(
      parseLocationDetails('wrld_abc:12345~private(usr_owner)~canRequestInvite')
    ).toMatchObject({
      isRealInstance: true,
      accessType: 'invite+',
      accessTypeName: 'invite+',
      canRequestInvite: true,
      region: 'us'
    });
  });

  test('parses group access variants and defaults region to us for instances', () => {
    expect(
      parseLocationDetails('wrld_abc:12345~group(grp_demo)~groupAccessType(public)')
    ).toMatchObject({
      accessType: 'group',
      accessTypeName: 'groupPublic',
      groupId: 'grp_demo',
      groupAccessType: 'public',
      region: 'us'
    });

    expect(
      parseLocationDetails('wrld_abc:12345~group(grp_demo)~groupAccessType(plus)~region(jp)')
    ).toMatchObject({
      accessType: 'group',
      accessTypeName: 'groupPlus',
      groupAccessType: 'plus',
      region: 'jp'
    });
  });

  test('keeps literal private placeholder out of real instance analysis', () => {
    expect(parseLocationDetails('private')).toMatchObject({
      isPrivate: true,
      isRealInstance: false,
      accessType: '',
      region: ''
    });
  });
});
