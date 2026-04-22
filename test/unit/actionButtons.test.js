import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('acquaintance action buttons', () => {
  test('uses emphasized centered action buttons', () => {
    const appSource = fs.readFileSync(appJsPath, 'utf8');
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(appSource).toContain('class="action-link-button"');
    expect(appSource).toContain('type="primary" plain');
    expect(cssSource).toContain('justify-content: center;');
    expect(cssSource).toContain('.action-link-button');
  });
});
