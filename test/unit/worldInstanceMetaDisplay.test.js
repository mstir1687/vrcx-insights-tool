import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { getWorldMetaLabel } from '../../src/static/hiddenIdentifiers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');

describe('world instance meta display', () => {
  test('formats room type and region labels for display', () => {
    expect(getWorldMetaLabel({ accessTypeName: 'friends', region: 'jp' })).toBe('好友 / JP');
    expect(getWorldMetaLabel({ accessTypeName: 'groupPlus', region: 'us' })).toBe('群组+ / US');
    expect(getWorldMetaLabel({ accessTypeName: 'invite+', region: 'eu' })).toBe('邀请+ / EU');
    expect(getWorldMetaLabel({ accessTypeName: 'public', region: '' })).toBe('公开');
  });

  test('renders world instance meta in both timeline and pair tables', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect((source.match(/class="stacked-text world-cell"/g) || []).length).toBe(2);
    expect((source.match(/class="world-meta"/g) || []).length).toBe(2);
  });
});
