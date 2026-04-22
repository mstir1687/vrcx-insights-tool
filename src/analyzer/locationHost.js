export function parseLocationHost(location, displayNameMap = new Map()) {
  const text = String(location || '');
  const tags = text.split('~').slice(1);

  let privateId = null;
  let hiddenId = null;
  let friendsId = null;
  let groupId = null;

  for (const raw of tags) {
    if (raw.startsWith('private(') && raw.endsWith(')')) {
      privateId = raw.slice(8, -1);
    } else if (raw.startsWith('hidden(') && raw.endsWith(')')) {
      hiddenId = raw.slice(7, -1);
    } else if (raw.startsWith('friends(') && raw.endsWith(')')) {
      friendsId = raw.slice(8, -1);
    } else if (raw.startsWith('group(') && raw.endsWith(')')) {
      groupId = raw.slice(6, -1);
    }
  }

  if (privateId) {
    return {
      hostType: 'private',
      hostUserId: privateId,
      hostDisplayName: displayNameMap.get(privateId) || null,
      groupId: null
    };
  }
  if (hiddenId) {
    return {
      hostType: 'hidden',
      hostUserId: hiddenId,
      hostDisplayName: displayNameMap.get(hiddenId) || null,
      groupId: null
    };
  }
  if (friendsId) {
    return {
      hostType: 'friends',
      hostUserId: friendsId,
      hostDisplayName: displayNameMap.get(friendsId) || null,
      groupId: null
    };
  }
  if (groupId) {
    return {
      hostType: 'group',
      hostUserId: null,
      hostDisplayName: null,
      groupId
    };
  }

  return {
    hostType: 'unknown',
    hostUserId: null,
    hostDisplayName: null,
    groupId: null
  };
}
