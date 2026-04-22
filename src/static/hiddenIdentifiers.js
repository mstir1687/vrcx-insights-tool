export function getDisplayNameLabel({ displayName, userId, prefix = '' }) {
  return `${prefix}${displayName || userId || '未知用户'}`;
}

export function getDisplayNameTooltip({ displayName, userId }) {
  if (!displayName || !userId) {
    return '';
  }
  return userId;
}

export function getWorldLabel({ worldName, location }) {
  return worldName || location || '未知世界';
}

const ACCESS_TYPE_LABELS = {
  public: '公开',
  friends: '好友',
  'friends+': '好友+',
  group: '群组',
  groupPlus: '群组+',
  groupPublic: '群组公开',
  invite: '邀请',
  'invite+': '邀请+'
};

function formatRegion(region) {
  const value = String(region || '').trim();
  if (!value) {
    return '';
  }
  return value.toUpperCase();
}

export function getWorldMetaLabel({ accessTypeName, accessType, region }) {
  const parts = [];
  const accessLabel = ACCESS_TYPE_LABELS[accessTypeName] || ACCESS_TYPE_LABELS[accessType] || '';
  const regionLabel = formatRegion(region);

  if (accessLabel) {
    parts.push(accessLabel);
  }
  if (regionLabel) {
    parts.push(regionLabel);
  }
  return parts.join(' / ');
}

export function getWorldTooltip({ worldName, location }) {
  if (!worldName || !location) {
    return '';
  }
  return location;
}
