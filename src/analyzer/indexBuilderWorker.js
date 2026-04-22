import { parentPort, workerData } from 'node:worker_threads';

import { buildIndex } from './indexBuilder.js';

try {
  const index = buildIndex(workerData?.dbPath || '');
  parentPort.postMessage({
    ok: true,
    index
  });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  });
}
