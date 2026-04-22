import { Worker } from 'node:worker_threads';

export function buildIndexInWorker(dbPath, { workerFactory = (url, options) => new Worker(url, options) } = {}) {
  return new Promise((resolve, reject) => {
    const worker = workerFactory(new URL('./indexBuilderWorker.js', import.meta.url), {
      type: 'module',
      workerData: { dbPath }
    });

    worker.once('message', (message) => {
      if (message?.ok) {
        resolve(message.index);
        return;
      }
      reject(new Error(message?.error || '索引重算失败'));
    });

    worker.once('error', reject);

    worker.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`索引重算线程退出异常: ${code}`));
      }
    });
  });
}
