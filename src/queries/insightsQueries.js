function parseOptionalPositiveInt(input) {
  if (input == null || input === '') {
    return null;
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
}

export function paginateCollection(rows, pageInput, pageSizeInput) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const requestedPage = parseOptionalPositiveInt(pageInput);
  const requestedPageSize = parseOptionalPositiveInt(pageSizeInput);

  if (!requestedPage && !requestedPageSize) {
    return {
      rows: list,
      total,
      page: 1,
      pageSize: total || 10,
      totalPages: total > 0 ? 1 : 0
    };
  }

  const pageSize = requestedPageSize || 10;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
  const page = Math.min(requestedPage || 1, Math.max(totalPages, 1));
  const start = (page - 1) * pageSize;

  return {
    rows: list.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages
  };
}

export function resolveDefaultRange(query) {
  if (query?.all === '1') {
    return { from: null, to: null };
  }

  const { from, to } = query ?? {};
  if (from || to) {
    return { from, to };
  }

  const now = new Date();
  const toDate = now.toISOString().slice(0, 10);
  const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { from: fromDate, to: toDate };
}

export function runMetaQuery(service) {
  return service.getMeta();
}

export function runReloadQuery(service) {
  return service.reload();
}

export function runAcquaintancesQuery(service, query = {}) {
  const { from, to } = resolveDefaultRange(query);
  const { limit, page, pageSize, meetPage, meetPageSize, overlapPage, overlapPageSize } = query;
  const data = service.getAcquaintances({
    from,
    to,
    limit: Number(limit || 50)
  });
  const sharedPage = page ?? meetPage ?? overlapPage;
  const sharedPageSize = pageSize ?? meetPageSize ?? overlapPageSize;
  const meet = paginateCollection(data.byMeetCount, sharedPage, sharedPageSize);
  const overlap = paginateCollection(data.byOverlap, sharedPage, sharedPageSize);
  const total = Math.max(meet.total, overlap.total);
  const totalPages = Math.max(meet.totalPages, overlap.totalPages);

  return {
    ...data,
    page: meet.page,
    pageSize: meet.pageSize,
    total,
    totalPages,
    byMeetCount: meet.rows,
    byMeetCountTotal: meet.total,
    byMeetCountPage: meet.page,
    byMeetCountPageSize: meet.pageSize,
    byMeetCountTotalPages: meet.totalPages,
    byOverlap: overlap.rows,
    byOverlapTotal: overlap.total,
    byOverlapPage: overlap.page,
    byOverlapPageSize: overlap.pageSize,
    byOverlapTotalPages: overlap.totalPages
  };
}

export function runTimelineQuery(service, query = {}) {
  const { from, to } = resolveDefaultRange(query);
  const {
    userId,
    scope,
    sessionLimit,
    companionLimit,
    page,
    pageSize,
    sessionPage,
    sessionPageSize,
    companionPage,
    companionPageSize
  } = query;
  const data = service.getTimeline({
    userId,
    from,
    to,
    sessionLimit: parseOptionalPositiveInt(sessionLimit),
    companionLimit: parseOptionalPositiveInt(companionLimit) ?? 200
  });
  const timelineScope = scope === 'companions' ? 'companions' : 'sessions';
  const sessions = paginateCollection(data.sessions, sessionPage ?? page, sessionPageSize ?? pageSize);
  const companions = paginateCollection(data.companions, companionPage ?? page, companionPageSize ?? pageSize);
  const primary = timelineScope === 'companions' ? companions : sessions;

  return {
    ...data,
    scope: timelineScope,
    page: primary.page,
    pageSize: primary.pageSize,
    total: primary.total,
    totalPages: primary.totalPages,
    sessions: sessions.rows,
    sessionsTotal: sessions.total,
    sessionPage: sessions.page,
    sessionPageSize: sessions.pageSize,
    sessionTotalPages: sessions.totalPages,
    companions: companions.rows,
    companionsTotal: companions.total,
    companionPage: companions.page,
    companionPageSize: companions.pageSize,
    companionTotalPages: companions.totalPages
  };
}

export function runRelationshipTopQuery(service, query = {}) {
  const { from, to } = resolveDefaultRange(query);
  const { userId, scope, limit, page, pageSize } = query;
  const data = service.getRelationshipTop({
    userId,
    scope,
    from,
    to,
    limit: Number(limit || 100)
  });
  const paged = paginateCollection(data.rows, page, pageSize);

  return {
    ...data,
    rows: paged.rows,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    totalPages: paged.totalPages
  };
}

export function runRelationshipPairQuery(service, query = {}) {
  const { from, to } = resolveDefaultRange(query);
  const { userIdA, userIdB, page, pageSize } = query;
  const data = service.getRelationshipPair({
    userIdA,
    userIdB,
    from,
    to
  });
  const paged = paginateCollection(data.records, page, pageSize);

  return {
    ...data,
    records: paged.rows,
    total: paged.total,
    page: paged.page,
    pageSize: paged.pageSize,
    totalPages: paged.totalPages
  };
}

