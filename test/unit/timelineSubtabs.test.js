import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('timeline subtabs template', () => {
  test('defines sessions and companions timeline subtabs', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('selectedTimelineTab');
    expect(source).toContain('<el-tabs v-model="state.selectedTimelineTab" class="sub-tabs">');
    expect(source).toContain('label="时间流"');
    expect(source).toContain('name="sessions"');
    expect(source).toContain('label="陪伴占比（同房时长）"');
    expect(source).toContain('name="companions"');
    expect(source).toContain('timeline-query-card timeline-sessions-card');
    expect(source).toContain('timeline-query-card timeline-companions-card');
    expect(source).toContain(':total="state.timeline.sessionsTotal"');
    expect(source).toContain(':total="state.timeline.companionsTotal"');
    expect(source).toContain("qs.set('scope', state.selectedTimelineTab);");
  });
});
