import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appJsPath = path.resolve(__dirname, '../../src/static/app.js');
const stylesPath = path.resolve(__dirname, '../../src/static/styles.css');

describe('renderer settings and onboarding ui', () => {
  test('contains a settings entry and VRCX data directory onboarding copy', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('label="设置"');
    expect(source).toContain('VRCX数据文件夹');
    expect(source).toContain('chooseDataDirectory');
  });

  test('contains an about section with the repository link in settings', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('关于项目');
    expect(source).toContain('@click="handleAboutTitleClick"');
    expect(source).toContain("const versionFileUrl = new URL('../../Version', import.meta.url);");
    expect(source).toContain('版本号');
    expect(source).toContain("{{ state.versionText || '-' }}");
    expect(source).toContain('贡献者');
    expect(source).toContain('梦璃雨落');
    expect(source).toContain("versionText: ''");
    expect(source).toContain('async function loadVersionText()');
    expect(source).toContain('await fetch(versionFileUrl);');
    expect(source).toContain('仓库地址');
    expect(source).toContain('https://github.com/meng-luo/vrcx-insights-tool');
    expect(source).toContain('@click.prevent="openRepositoryLink"');
    expect(source).toContain('async function openRepositoryLink()');
  });

  test('contains a hidden five-click trigger for renderer devtools in settings', () => {
    const source = fs.readFileSync(appJsPath, 'utf8');

    expect(source).toContain('devtoolsClickCount: 0');
    expect(source).toContain('const devtoolsUnlockClickCount = 5;');
    expect(source).toContain('function handleAboutTitleClick()');
    expect(source).toContain('state.devtoolsClickCount += 1;');
    expect(source).toContain('await getInsightsApi().openDevTools()');
    expect(source).toContain('已打开界面调试工具');
    expect(source).toContain('state.devtoolsClickCount = 0;');
  });

  test('uses tighter title spacing for settings cards', () => {
    const cssSource = fs.readFileSync(stylesPath, 'utf8');

    expect(cssSource).toContain('.settings-card .section-title-row');
    expect(cssSource).toContain('margin-bottom: 6px;');
    expect(cssSource).toContain('.settings-card .section-title-row h2');
    expect(cssSource).toContain('margin: 0;');
  });
});
