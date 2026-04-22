function buildEmptyDetails(location) {
  return {
    tag: String(location || ''),
    isOffline: false,
    isPrivate: false,
    isTraveling: false,
    isRealInstance: false,
    worldId: '',
    instanceId: '',
    instanceName: '',
    accessType: '',
    accessTypeName: '',
    region: '',
    userId: null,
    hiddenId: null,
    privateId: null,
    friendsId: null,
    groupId: null,
    groupAccessType: null,
    canRequestInvite: false,
    strict: false,
    ageGate: false
  };
}

export function parseLocationDetails(location) {
  let tag = String(location || '');
  const details = buildEmptyDetails(tag);

  if (tag === 'offline' || tag === 'offline:offline') {
    details.isOffline = true;
    return details;
  }
  if (tag === 'private' || tag === 'private:private') {
    details.isPrivate = true;
    return details;
  }
  if (tag === 'traveling' || tag === 'traveling:traveling') {
    details.isTraveling = true;
    return details;
  }
  if (!tag || tag.startsWith('local')) {
    return details;
  }

  details.isRealInstance = true;
  const sep = tag.indexOf(':');
  if (sep < 0) {
    details.worldId = tag;
    return details;
  }

  details.worldId = tag.slice(0, sep);
  details.instanceId = tag.slice(sep + 1);

  details.instanceId.split('~').forEach((segment, index) => {
    if (index === 0) {
      details.instanceName = segment;
      return;
    }

    const start = segment.indexOf('(');
    const end = start >= 0 ? segment.lastIndexOf(')') : -1;
    const key = end >= 0 ? segment.slice(0, start) : segment;
    const value = start < end ? segment.slice(start + 1, end) : '';

    if (key === 'hidden') {
      details.hiddenId = value;
    } else if (key === 'private') {
      details.privateId = value;
    } else if (key === 'friends') {
      details.friendsId = value;
    } else if (key === 'canRequestInvite') {
      details.canRequestInvite = true;
    } else if (key === 'region') {
      details.region = value;
    } else if (key === 'group') {
      details.groupId = value;
    } else if (key === 'groupAccessType') {
      details.groupAccessType = value;
    } else if (key === 'strict') {
      details.strict = true;
    } else if (key === 'ageGate') {
      details.ageGate = true;
    }
  });

  details.accessType = 'public';
  if (details.privateId !== null) {
    details.accessType = details.canRequestInvite ? 'invite+' : 'invite';
    details.userId = details.privateId;
  } else if (details.friendsId !== null) {
    details.accessType = 'friends';
    details.userId = details.friendsId;
  } else if (details.hiddenId !== null) {
    details.accessType = 'friends+';
    details.userId = details.hiddenId;
  } else if (details.groupId !== null) {
    details.accessType = 'group';
  }

  details.accessTypeName = details.accessType;
  if (details.groupAccessType === 'public') {
    details.accessTypeName = 'groupPublic';
  } else if (details.groupAccessType === 'plus') {
    details.accessTypeName = 'groupPlus';
  }

  if (!details.region && details.instanceId) {
    details.region = 'us';
  }

  return details;
}
