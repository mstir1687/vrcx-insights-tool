import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('element plus theme overrides', () => {
  test('defines dark theme tokens for element plus surfaces', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');

    expect(css).toContain('--el-bg-color:');
    expect(css).toContain('--el-fill-color-blank:');
    expect(css).toContain('--el-table-row-striped-bg-color:');
    expect(css).toContain('color-scheme: dark');
  });
});
