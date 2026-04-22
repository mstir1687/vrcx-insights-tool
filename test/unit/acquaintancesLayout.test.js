import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('acquaintances table layout', () => {
  test('gives the dual rankings a dedicated wide desktop layout', () => {
    const appSource = fs.readFileSync(appJsPath, 'utf8');
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(appSource).toContain('class="section-grid two acquaintances-grid"');
    expect(cssSource).toContain('.acquaintances-grid');
    expect(cssSource).toContain('grid-template-columns: repeat(2, minmax(660px, 1fr));');
    expect(cssSource).toContain('overflow-x: auto;');
    expect(cssSource).toContain('width: min(100%, 1360px);');
  });
});
