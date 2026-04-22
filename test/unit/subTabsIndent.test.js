import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('sub tabs spacing', () => {
  test('adds left padding so secondary tab rails do not touch the container edge', () => {
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(cssSource).toContain('.sub-tabs > .el-tabs__header');
    expect(cssSource).toContain('padding-left: 14px;');
  });
});
