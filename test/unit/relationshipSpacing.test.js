import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('relationship card spacing', () => {
  test('uses dedicated spacing hooks for relationship query cards', () => {
    const appSource = fs.readFileSync(appJsPath, 'utf8');
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(appSource).toContain('relationship-query-card relationship-top-card');
    expect(appSource).toContain('relationship-query-card relationship-pair-card');
    expect(cssSource).toContain('.relationship-query-card > .el-card__body');
    expect(cssSource).toContain('.relationship-top-card .query-control-row');
  });
});
