export function buildSelectableUserOptions(meta, extraUsers = []) {
  if (!meta) {
    return [];
  }

  const mergedUsers = [
    { userId: meta.selfUserId, displayName: `我 - ${meta.selfDisplayName}` },
    ...(meta.friends || []),
    ...(extraUsers || [])
  ];

  const seen = new Set();
  return mergedUsers.filter((user) => {
    if (!user?.userId || seen.has(user.userId)) {
      return false;
    }
    seen.add(user.userId);
    return true;
  });
}
