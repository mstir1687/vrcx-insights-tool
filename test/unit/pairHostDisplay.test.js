import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('pair host display', () => {
  test('does not render host type tag in pair relationship table', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).not.toContain('<el-tag class="inline-tag" size="small" effect="plain">{{ row.hostType }}</el-tag>');
  });
});
