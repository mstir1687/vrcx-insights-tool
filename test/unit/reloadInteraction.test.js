import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('manual reload interaction behavior', () => {
  test('refreshes visible data silently after recalculation so cards stay interactive', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('async function applyAllViews(options = {})');
    expect(source).toContain('await applyAllViews({ silent: true });');
    expect(source).toContain('async function loadAcquaintances(options = {})');
    expect(source).toContain('async function loadTimeline(options = {})');
    expect(source).toContain('async function loadRelationshipTop(options = {})');
    expect(source).toContain('async function loadRelationshipPair(options = {})');
    expect(source).toContain('const silent = Boolean(options?.silent);');
  });
});
