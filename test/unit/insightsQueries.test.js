import { describe, expect, test } from 'vitest';

import {
  paginateCollection,
  runTimelineQuery
} from '../../src/queries/insightsQueries.js';

describe('insights query helpers', () => {
  test('paginateCollection returns the full collection when pagination is omitted', () => {
    const out = paginateCollection([{ id: 1 }, { id: 2 }]);

    expect(out).toMatchObject({
      rows: [{ id: 1 }, { id: 2 }],
      total: 2,
      page: 1,
      pageSize: 2,
      totalPages: 1
    });
  });

  test('runTimelineQuery uses the requested scope metadata instead of the larger sibling table', () => {
    const service = {
      getTimeline() {
        return {
          sessions: Array.from({ length: 8 }, (_, index) => ({ id: `s-${index}` })),
          companions: [{ id: 'c-1' }]
        };
      }
    };

    const out = runTimelineQuery(service, {
      userId: 'usr_self',
      scope: 'companions',
      companionPageSize: '1'
    });

    expect(out.total).toBe(1);
    expect(out.pageSize).toBe(1);
    expect(out.sessionsTotal).toBe(8);
    expect(out.companionsTotal).toBe(1);
  });
});
