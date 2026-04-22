export function calculateOverlapMs(listA, listB) {
  let i = 0;
  let j = 0;
  let total = 0;

  while (i < listA.length && j < listB.length) {
    const a = listA[i];
    const b = listB[j];

    const start = Math.max(a.startMs, b.startMs);
    const end = Math.min(a.endMs, b.endMs);
    if (end > start) {
      total += end - start;
    }

    if (a.endMs <= b.endMs) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return total;
}

export function collectOverlapSegments(listA, listB) {
  let i = 0;
  let j = 0;
  const segments = [];

  while (i < listA.length && j < listB.length) {
    const a = listA[i];
    const b = listB[j];

    const start = Math.max(a.startMs, b.startMs);
    const end = Math.min(a.endMs, b.endMs);
    if (end > start) {
      segments.push({ startMs: start, endMs: end, overlapMs: end - start });
    }

    if (a.endMs <= b.endMs) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return segments;
}

export function calculatePeakOccupancy(sessions) {
  if (!sessions || sessions.length === 0) {
    return 0;
  }

  const events = [];
  for (const item of sessions) {
    events.push({ t: item.startMs, delta: 1 });
    events.push({ t: item.endMs, delta: -1 });
  }

  events.sort((a, b) => {
    if (a.t !== b.t) {
      return a.t - b.t;
    }
    return a.delta - b.delta;
  });

  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    if (current > peak) {
      peak = current;
    }
  }
  return peak;
}

export function isSelfPresentInSegments(selfSessions, segments) {
  if (!selfSessions || selfSessions.length === 0 || !segments || segments.length === 0) {
    return false;
  }
  return collectOverlapSegments(selfSessions, segments).length > 0;
}
