import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const iconPath = path.resolve(__dirname, '../../build/icon.ico');

describe('windows packaging config', () => {
  test('declares Windows packaging scripts and electron-builder metadata', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.scripts).toMatchObject({
      'build:win': 'electron-builder --win nsis portable --x64',
      'release:win': 'electron-builder --win nsis portable --x64 --publish never'
    });

    expect(packageJson.devDependencies).toMatchObject({
      'electron-builder': expect.any(String)
    });

    expect(packageJson.build?.appId).toBe('com.mengluo.vrcx-insights-tool');
    expect(packageJson.build?.productName).toBe('VRCX Insights Tool');
    expect(packageJson.build?.directories).toMatchObject({
      output: 'dist',
      buildResources: 'build'
    });
    expect(packageJson.build?.files).toEqual(['src/**/*', 'package.json', 'Version']);
    expect(packageJson.build?.extraMetadata).toEqual({ main: 'src/electron/main.js' });
    expect(packageJson.build?.asar).toBe(true);
    expect(packageJson.build?.toolsets).toMatchObject({
      winCodeSign: '1.1.0'
    });
    expect(packageJson.build?.win).toMatchObject({
      icon: 'build/icon.ico',
      target: [
        { target: 'nsis', arch: ['x64'] },
        { target: 'portable', arch: ['x64'] }
      ],
      artifactName: '${productName}-${version}-${name}.${ext}'
    });
    expect(packageJson.build?.nsis).toMatchObject({
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      artifactName: '${productName}-${version}-setup.${ext}'
    });
    expect(packageJson.build?.portable).toMatchObject({
      artifactName: '${productName}-${version}-portable.${ext}'
    });

    expect(fs.existsSync(iconPath)).toBe(true);

    const iconBuffer = fs.readFileSync(iconPath);
    expect(iconBuffer.length).toBeGreaterThan(256);
    expect(iconBuffer.readUInt16LE(0)).toBe(0);
    expect(iconBuffer.readUInt16LE(2)).toBe(1);

    const imageCount = iconBuffer.readUInt16LE(4);
    expect(imageCount).toBeGreaterThan(0);

    const entries = Array.from({ length: imageCount }, (_, index) => {
      const offset = 6 + index * 16;
      const widthByte = iconBuffer.readUInt8(offset);
      const heightByte = iconBuffer.readUInt8(offset + 1);
      const bytesInRes = iconBuffer.readUInt32LE(offset + 8);
      const imageOffset = iconBuffer.readUInt32LE(offset + 12);
      return {
        width: widthByte === 0 ? 256 : widthByte,
        height: heightByte === 0 ? 256 : heightByte,
        bytesInRes,
        imageOffset
      };
    });

    for (const entry of entries) {
      expect(entry.bytesInRes).toBeGreaterThan(0);
      expect(entry.imageOffset).toBeGreaterThanOrEqual(6 + imageCount * 16);
      expect(entry.imageOffset + entry.bytesInRes).toBeLessThanOrEqual(iconBuffer.length);
    }

    expect(entries.some((entry) => entry.width >= 32 && entry.height >= 32)).toBe(true);
  });
});
