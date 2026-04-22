import {
  runAcquaintancesQuery,
  runMetaQuery,
  runRelationshipPairQuery,
  runRelationshipTopQuery,
  runTimelineQuery
} from '../queries/insightsQueries.js';

function getService(runtime) {
  return runtime.getService();
}

function getOwnerWindow(event) {
  if (typeof event?.sender?.getOwnerBrowserWindow === 'function') {
    return event.sender.getOwnerBrowserWindow();
  }
  return null;
}

const CHANNEL_HANDLERS = {
  'app:get-state': (_event, _query, runtime) => runtime.getState(),
  'app:choose-data-directory': (event, _query, runtime) => runtime.chooseDataDirectory(getOwnerWindow(event)),
  'app:update-data-directory': (_event, query, runtime) => runtime.updateDataDirectory(query?.dataDir),
  'app:open-external-url': (_event, query, runtime) => runtime.openExternalUrl(query?.url),
  'app:open-devtools': (event, _query, runtime) => runtime.openDevTools(getOwnerWindow(event)),
  'insights:get-meta': (_event, query, runtime) => runMetaQuery(getService(runtime), query),
  'insights:reload': (_event, _query, runtime) => runtime.reload(),
  'insights:get-acquaintances': (_event, query, runtime) => runAcquaintancesQuery(getService(runtime), query),
  'insights:get-timeline': (_event, query, runtime) => runTimelineQuery(getService(runtime), query),
  'insights:get-relationship-top': (_event, query, runtime) => runRelationshipTopQuery(getService(runtime), query),
  'insights:get-relationship-pair': (_event, query, runtime) => runRelationshipPairQuery(getService(runtime), query)
};

export function registerInsightsIpc({ ipcMain, runtime }) {
  for (const [channel, handler] of Object.entries(CHANNEL_HANDLERS)) {
    if (typeof ipcMain.removeHandler === 'function') {
      ipcMain.removeHandler(channel);
    }
    ipcMain.handle(channel, (event, query) => handler(event, query, runtime));
  }
}
