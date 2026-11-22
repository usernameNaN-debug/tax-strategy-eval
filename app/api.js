// Talks to the backend worker. Falls back to running the service on the main
// thread where module workers are unavailable.
let worker = null;
let seq = 0;
const pending = new Map();

function boot() {
  try {
    worker = new Worker(new URL('../src/worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
    };
    worker.onerror = () => { worker = null; };
  } catch { worker = null; }
}
boot();

let local = null;
async function direct(method, args) {
  local ||= (await import('../src/service.js')).api;
  return local[method](...args);
}

export function call(method, ...args) {
  if (!worker) return direct(method, args);
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, method, args });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); direct(method, args).then(resolve, reject); } }, 8000);
  });
}
