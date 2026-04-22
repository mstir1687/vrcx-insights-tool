import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');

describe('windows packaging config', () => {
  test('declares Windows packaging scripts and electron-builder metadata', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.scripts).toMatchObject({
      'build:win': 'electron-builder --win nsis portable --x64',
      'release:win': 'npm run build:win'
    });

    expect(packageJson.devDependencies).toMatchObject({
      'electron-builder': expect.any(String)
    });

    expect(packageJson.build).toMatchObject({
      appId: 'com.vrcxinsights.app',
      productName: 'VRCX Insights Tool',
      directories: {
        output: 'release',
        buildResources: 'build'
      },
      files: ['dist/**/*', 'src/electron/**/*', 'package.json'],
      extraMetadata: {
        main: 'src/electron/main.js'
      },
      asar: true,
      win: {
        icon: 'build/icon.ico',
        target: [
          { target: 'nsis', arch: ['x64'] },
          { target: 'portable', arch: ['x64'] }
        ],
        artifactName: '${productName}-${version}-${arch}.${ext}'
      },
      nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        artifactName: '${productName}-Setup-${version}-${arch}.${ext}'
      },
      portable: {
        artifactName: '${productName}-Portable-${version}-${arch}.${ext}'
      }
    });
  });
});
