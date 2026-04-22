import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('renderer desktop bridge usage', () => {
  test('uses the preload bridge instead of fetch API calls', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('window.vrcxInsights');
    expect(source).not.toContain("fetch('/api/");
    expect(source).not.toContain('const res = await fetch(url);');
  });
});
