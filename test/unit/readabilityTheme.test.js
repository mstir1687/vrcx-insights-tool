import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('readability theme', () => {
  test('adds stronger contrast for tabs, card headers, table headers, and inputs', () => {
    const css = fs.readFileSync(stylesPath, 'utf8');

    expect(css).toContain('.el-tabs__item.is-active');
    expect(css).toContain('.el-card__header');
    expect(css).toContain('.el-table th.el-table__cell');
    expect(css).toContain('.el-input__inner');
  });
});
