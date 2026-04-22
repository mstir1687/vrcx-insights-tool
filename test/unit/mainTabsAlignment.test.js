import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('main tabs alignment', () => {
  test('centers the primary tab rail and constrains the desktop content track', () => {
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(cssSource).toContain('.main-tabs > .el-tabs__header .el-tabs__nav-scroll');
    expect(cssSource).toContain('.main-tabs > .el-tabs__header .el-tabs__nav');
    expect(cssSource).toContain('.main-tabs > .el-tabs__content');
    expect(cssSource).toContain('.main-tabs > .el-tabs__header .el-tabs__item:first-child');
    expect(cssSource).toContain('.main-tabs > .el-tabs__header .el-tabs__item:nth-child(2)');
    expect(cssSource).toContain('.main-tabs > .el-tabs__header .el-tabs__item:last-child');
    expect(cssSource).toContain('display: flex;');
  });
});
