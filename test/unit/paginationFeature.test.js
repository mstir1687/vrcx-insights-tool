import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('pagination feature', () => {
  test('renders pagination controls for all major tables', () => {
    const appSource = fs.readFileSync(appJsPath, 'utf8');
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect((appSource.match(/class="table-pagination"/g) || []).length).toBe(5);
    expect(appSource).toContain('pagination: {');
    expect(appSource).toContain(':total="state.acquaintances.total"');
    expect(appSource).toContain(':total="state.timeline.sessionsTotal"');
    expect(appSource).toContain(':total="state.timeline.companionsTotal"');
    expect(appSource).toContain(':total="state.relationshipPair.recordsTotal"');
    expect(appSource).toContain('await loadPaginationData(key)');
    expect(cssSource).toContain('.table-pagination');
  });
});
