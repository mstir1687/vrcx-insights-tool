export function toDateRangeMs({ from, to }) {
  let fromMs = null;
  let toMs = null;

  if (from) {
    const dt = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) {
      fromMs = dt.getTime();
    }
  }

  if (to) {
    const dt = new Date(`${to}T00:00:00`);
    if (!Number.isNaN(dt.getTime())) {
      toMs = dt.getTime() + 24 * 60 * 60 * 1000;
    }
  }

  if (fromMs !== null && toMs !== null && fromMs > toMs) {
    const temp = fromMs;
    fromMs = toMs - 24 * 60 * 60 * 1000;
    toMs = temp + 24 * 60 * 60 * 1000;
  }

  return { fromMs, toMs };
}

export function sessionIntersectsRange(session, fromMs, toMs) {
  if (fromMs !== null && session.endMs < fromMs) {
    return false;
  }
  if (toMs !== null && session.startMs >= toMs) {
    return false;
  }
  return true;
}

export function clipSessionToRange(session, fromMs, toMs) {
  const startMs = fromMs === null ? session.startMs : Math.max(session.startMs, fromMs);
  const endMs = toMs === null ? session.endMs : Math.min(session.endMs, toMs);
  if (endMs <= startMs) {
    return null;
  }
  return {
    ...session,
    startMs,
    endMs,
    durationMs: endMs - startMs,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString()
  };
}
