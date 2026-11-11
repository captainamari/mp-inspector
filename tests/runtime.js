const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Isolated Mini Program host contract; this does not emulate the WeChat renderer.
function runtime(root) {
  const requests = [], apps = [], pages = [], components = [], output = [];
  const timers = new Map(), storage = new Map();
  let timerId = 0;
  const host = {
    console: Object.fromEntries(['log', 'info', 'warn', 'error', 'debug'].map(name =>
      [name, (...args) => output.push([name, ...args])])),
    wx: {
      request(options) {
        const task = { abort() {} };
        requests.push({ options, task, receiver: this });
        return task;
      },
      getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 800 }),
      getStorageInfoSync: () => ({ keys: [...storage.keys()], currentSize: 1, limitSize: 10240 }),
      getStorageSync: key => storage.get(key),
      setStorageSync: (key, value) => storage.set(key, value),
      removeStorageSync: key => storage.delete(key),
      clearStorageSync: () => storage.clear(),
      setClipboardData: options => { host.clipboard = options.data; if (options.success) options.success(); },
      showToast: () => {}
    },
    App: definition => { apps.push(definition); return definition; },
    Page: definition => { pages.push(definition); return definition; },
    Component: definition => { components.push(definition); return definition; },
    setInterval: callback => { timers.set(++timerId, callback); return timerId; },
    clearInterval: id => timers.delete(id),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id)
  };
  const context = vm.createContext(host), cache = new Map();
  function load(filename) {
    filename = path.resolve(filename);
    if (!path.extname(filename)) filename += '.js';
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const code = fs.readFileSync(filename, 'utf8');
    if (filename.endsWith('.json')) module.exports = JSON.parse(code);
    else new vm.Script('(function(require,module,exports){\n' + code + '\n})', { filename })
      .runInContext(context)(name => {
        if (!name.startsWith('.')) throw new Error('Runtime dependency: ' + name);
        return load(path.resolve(path.dirname(filename), name));
      }, module, module.exports);
    return module.exports;
  }
  const original = { request: host.wx.request, App: host.App, Page: host.Page, log: host.console.log };
  const sdk = load(path.join(root, 'core/index.js'));
  function component(name) {
    load(path.join(root, 'components', name, 'index.js'));
    const definition = components[components.length - 1];
    const instance = {
      data: JSON.parse(JSON.stringify(definition.data || {})),
      properties: Object.fromEntries(Object.entries(definition.properties || {}).map(([key, value]) => [key, value.value])),
      setData(update) {
        JSON.stringify(update); // Reject circular objects as the native serialization boundary would.
        for (const [key, value] of Object.entries(update)) {
          const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.');
          let target = this.data;
          for (const part of parts.slice(0, -1)) target = target[part];
          target[parts[parts.length - 1]] = value;
        }
      }
    };
    Object.assign(instance, definition.methods);
    return { definition, instance, attach: () => definition.lifetimes.attached.call(instance),
      detach: () => definition.lifetimes.detached && definition.lifetimes.detached.call(instance) };
  }
  return { sdk, host, original, requests, apps, pages, output, timers, storage, component };
}
module.exports = { runtime };
