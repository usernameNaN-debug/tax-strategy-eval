// RPC shim: the page posts {id, method, args}, the worker answers {id, result}.
import { api } from './service.js';

self.onmessage = async ({ data: { id, method, args } }) => {
  try {
    const result = await api[method](...(args || []));
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.stack || err) });
  }
};
