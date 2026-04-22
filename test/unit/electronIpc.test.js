import { describe, expect, test } from 'vitest';

import { registerInsightsIpc } from '../../src/electron/ipcHandlers.js';

describe('registerInsightsIpc', () => {
  test('registers the desktop query channels', () => {
    const handled = [];
    const ipcMain = {
      handle(channel, handler) {
        handled.push({ channel, handler });
      }
    };

    registerInsightsIpc({
      ipcMain,
      runtime: {
        getState() {
          return {};
        },
        getService() {
          return {
            getMeta() {
              return {};
            }
          };
        }
      }
    });

    expect(handled.map((item) => item.channel)).toEqual([
      'app:get-state',
      'app:choose-data-directory',
      'app:update-data-directory',
      'app:open-external-url',
      'app:open-devtools',
      'insights:get-meta',
      'insights:reload',
      'insights:get-acquaintances',
      'insights:get-timeline',
      'insights:get-relationship-top',
      'insights:get-relationship-pair'
    ]);
  });
});
