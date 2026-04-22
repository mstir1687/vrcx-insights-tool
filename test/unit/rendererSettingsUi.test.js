import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('renderer settings and onboarding ui', () => {
  test('contains a settings entry and VRCX data directory onboarding copy', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('label="设置"');
    expect(source).toContain('VRCX数据文件夹');
    expect(source).toContain('chooseDataDirectory');
  });
});
