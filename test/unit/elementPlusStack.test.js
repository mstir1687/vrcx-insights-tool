import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');

describe('frontend stack', () => {
  test('includes vue and element-plus dependencies', () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(pkg.dependencies?.vue).toBeTruthy();
    expect(pkg.dependencies?.['element-plus']).toBeTruthy();
  });
});
