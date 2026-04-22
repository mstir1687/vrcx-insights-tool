import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(__dirname, '../../src/static/index.html');
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('toolbar layout and locale', () => {
  test('loads zh-cn locale and defines compact toolbar classes', () => {
    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const appSource = fs.readFileSync(appJsPath, 'utf8');
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(indexHtml).toContain('../../node_modules/element-plus/dist/locale/zh-cn.min.js');
    expect(appSource).toContain('window.ElementPlusLocaleZhCn');
    expect(appSource).toContain('class="hero-range-picker"');
    expect(appSource).toContain('class="query-control-row"');
    expect(cssSource).toContain('.hero-range-picker');
    expect(cssSource).toContain('.query-control-row');
  });
});
