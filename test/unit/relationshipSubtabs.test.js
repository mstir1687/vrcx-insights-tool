import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('relationship subtabs template', () => {
  test('defines top and pair relationship subtabs', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('name="top"');
    expect(source).toContain('name="pair"');
    expect(source).toContain('label="单好友关系排行"');
    expect(source).toContain('label="双人关系查询"');
  });
});
