const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { runtime } = require('./runtime');
const root = path.resolve(__dirname, '..');
const targets = ['src', 'dist/mp-inspector', 'dist/mp-inspector-lite'];
const plain = value => JSON.parse(JSON.stringify(value));

for (const target of targets) {
  const directory = path.join(root, target);
  if (!fs.existsSync(directory)) throw new Error('Run npm run build before npm test');
  const fixture = () => runtime(directory);

  test(target + ': init is idempotent; show/hide changes visibility, not capture', () => {
    const { sdk, host } = fixture();
    sdk.init({ env: 'development' });
    const request = host.wx.request, log = host.console.log;
    sdk.init({ enabled: false });
    assert.equal(host.wx.request, request);
    assert.equal(host.console.log, log);
    assert.equal(sdk.isPanelVisible(), false);
    sdk.show({ enableConsole: false });
    assert.equal(sdk.getConfig().enableConsole, true);
    assert.equal(sdk.getPanelConfig().enableConsole, false);
    sdk.hide();
    host.console.log('still capturing');
    assert.equal(sdk.console.getLogList().length, 1);
    sdk.show();
    assert.equal(sdk.getPanelConfig().enableConsole, true);
    sdk.destroy();
  });

  test(target + ': destroy restores globals, clears records and resets config', () => {
    const { sdk, host, original, timers } = fixture();
    const descriptor = Object.getOwnPropertyDescriptor(host.wx, 'request');
    sdk.init({ enabled: true, enableStorage: false });
    host.console.log('before');
    host.wx.request({ url: 'https://example.com/data' });
    sdk.show();
    sdk.destroy();
    sdk.destroy();
    assert.equal(host.wx.request, original.request);
    assert.deepEqual(Object.getOwnPropertyDescriptor(host.wx, 'request'), descriptor);
    assert.equal(host.console.log, original.log);
    assert.equal(host.App, original.App);
    assert.equal(host.Page, original.Page);
    assert.equal('__originalLog' in host.console, false);
    assert.equal(sdk.console.getLogList().length, 0);
    assert.equal(sdk.network.getRequestList().length, 0);
    assert.equal(sdk.isPanelVisible(), false);
    assert.equal(timers.size, 0);
    sdk.init({ env: 'production' });
    assert.equal(sdk.isEnabled(), false);
    assert.equal(sdk.getConfig().enableStorage, true);
    assert.equal(host.wx.request, original.request);
    sdk.destroy();
  });

  test(target + ': request task, callback context and reusable options are preserved', () => {
    const { sdk, host, requests } = fixture();
    sdk.init({ enabled: true });
    const calls = [], receiver = { marker: true }, response = { statusCode: 201, data: { ok: true } };
    const options = Object.freeze({
      url: 'https://example.com/items', method: 'POST', data: { item: 1 },
      success(res) { calls.push(['success', this, res]); },
      fail(res) { calls.push(['fail', this, res]); },
      complete(res) { calls.push(['complete', this, res]); }
    });
    const task = host.wx.request(options);
    assert.equal(task, requests[0].task);
    assert.equal(requests[0].receiver, host.wx);
    requests[0].options.success.call(receiver, response);
    requests[0].options.complete.call(receiver, response);
    host.wx.request(options);
    const error = { errMsg: 'request:fail timeout' };
    requests[1].options.fail.call(receiver, error);
    requests[1].options.complete.call(receiver, error);
    assert.deepEqual(calls.map(call => call[0]), ['success', 'complete', 'fail', 'complete']);
    assert.ok(calls.every(call => call[1] === receiver));
    assert.equal(calls[0][2], response);
    assert.equal(sdk.network.getRequestList()[0].statusCode, 201);
    assert.equal(sdk.network.getRequestList()[1].status, 'fail');
    sdk.destroy();
  });

  test(target + ': late responses cannot overwrite records after clear or re-init', () => {
    const { sdk, host, requests } = fixture();
    let callbacks = 0;
    sdk.init({ enabled: true });
    host.wx.request({ url: '/old', success() { callbacks++; } });
    sdk.network.clearRequests();
    host.wx.request({ url: '/new' });
    requests[0].options.success({ statusCode: 500 });
    assert.equal(sdk.network.getRequestList()[0].statusCode, 'Pending');
    sdk.destroy();
    sdk.init({ enabled: true });
    host.wx.request({ url: '/new-session' });
    requests[1].options.success({ statusCode: 404 });
    assert.equal(sdk.network.getRequestList()[0].statusCode, 'Pending');
    assert.equal(callbacks, 1);
    sdk.destroy();
  });

  test(target + ': configured queue limits and serializable circular logs', () => {
    const { sdk, host, component } = fixture();
    sdk.init({ enabled: true, maxLogCount: 2, maxRequestCount: 1 });
    const object = {}; object.self = object;
    for (let i = 0; i < 3; i++) host.console.log(object, i);
    host.wx.request({ url: '/first' }); host.wx.request({ url: '/second' });
    assert.equal(sdk.console.getLogList().length, 2);
    assert.equal(sdk.network.getRequestList().length, 1);
    assert.match(sdk.console.getLogList()[0].data[0].value, /Circular/);
    assert.doesNotThrow(() => JSON.stringify(sdk.console.getLogList()));
    const panel = component('console-panel');
    assert.doesNotThrow(panel.attach);
    panel.detach();
    sdk.destroy();
  });

  test(target + ': error hooks preserve app callbacks and stop capture on destroy', () => {
    const { sdk, host, apps } = fixture();
    const calls = [], receiver = {};
    sdk.init({ enabled: true });
    const definition = {
      onError(message) { calls.push([this, message]); },
      onUnhandledRejection(event) { calls.push([this, event.reason]); }
    };
    const originalError = definition.onError;
    host.App(definition);
    assert.equal(definition.onError, originalError);
    apps[0].onError.call(receiver, 'runtime failure');
    apps[0].onUnhandledRejection.call(receiver, { reason: 0 });
    assert.equal(sdk.console.getLogList().length, 2);
    assert.equal(sdk.console.getLogList()[1].data[1].value, '0');
    sdk.destroy();
    apps[0].onError.call(receiver, 'after destroy');
    assert.equal(sdk.console.getLogList().length, 0);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call[0] === receiver));
  });

  test(target + ': mounted panels survive hide/destroy/re-init and detach cleanly', () => {
    const { sdk, component } = fixture();
    sdk.init({ enabled: true, showButton: false, panelHeight: 50 });
    sdk.show({ enableStorage: false });
    const panel = component('debug-panel');
    panel.attach();
    assert.equal(panel.instance.data.showStorage, false);
    assert.equal(panel.instance.data.showButton, false);
    assert.equal(panel.instance.data.panelHeight, 400);
    sdk.destroy();
    assert.equal(panel.instance.data.enabled, false);
    sdk.init({ enabled: true });
    sdk.show();
    assert.equal(panel.instance.data.enabled, true);
    assert.equal(panel.instance.data.showStorage, true);
    panel.detach();
    assert.equal(sdk.eventBus.listenerCount('panel:show'), 0);
    assert.equal(sdk.eventBus.listenerCount('sdk:destroy'), 0);
    sdk.destroy();
  });

  test(target + ': filtered console actions address stable log IDs', () => {
    const { sdk, host, component } = fixture();
    sdk.init({ enabled: true });
    host.console.log('first'); host.console.error('second');
    const panel = component('console-panel');
    panel.attach();
    panel.instance.onFilterChange({ currentTarget: { dataset: { type: 'error' } } });
    const id = panel.instance.data.logs[1].id;
    panel.instance.onToggleExpand({ currentTarget: { dataset: { id } } });
    assert.equal(panel.instance.data.logs[0].expanded, false);
    assert.equal(panel.instance.data.logs[1].expanded, true);
    panel.instance.onCopyLog({ currentTarget: { dataset: { id } } });
    assert.equal(host.clipboard, 'second');
    panel.detach(); sdk.destroy();
  });

  test(target + ': storage remains available with panel capture disabled', () => {
    const { sdk, storage } = fixture();
    sdk.init({ enabled: false });
    storage.set('demo', { value: 1 });
    assert.equal(sdk.storage.getAllStorage()[0].key, 'demo');
    assert.deepEqual(sdk.storage.getStorageItem('demo'), { value: 1 });
    sdk.storage.removeStorageItem('demo');
    assert.equal(storage.size, 0);
    sdk.destroy();
  });

  if (target.endsWith('-lite')) {
    test(target + ': no reporting hooks or requests even with logger configuration', () => {
      const { sdk, host, original, requests, timers } = fixture();
      sdk.init({ enabled: false, remoteLogger: { url: 'https://example.com/report' } });
      assert.equal(sdk.remoteLogger.supported, false);
      assert.equal(host.App, original.App);
      assert.equal(host.Page, original.Page);
      assert.equal(host.wx.request, original.request);
      sdk.eventBus.emit('error:remote', { message: 'ignored' });
      sdk.remoteLogger.flush();
      assert.equal(requests.length, 0);
      assert.equal(timers.size, 0);
      sdk.destroy();
    });
    continue;
  }

  test(target + ': remote-only capture, payload version, lifecycle args and no self-report', () => {
    const { sdk, host, requests, pages, original, timers } = fixture();
    const receiver = {}, calls = [];
    sdk.init({ enabled: false, remoteLogger: {
      url: 'https://example.com/report', reportTypes: ['console', 'error', 'network'],
      onReportSuccess() { throw new Error('isolated'); }
    } });
    assert.equal(sdk.isEnabled(), false);
    assert.equal(sdk.remoteLogger.supported, true);
    assert.equal(timers.size, 1);
    host.Page({ onHide(...args) { calls.push([this, args]); return 42; } });
    host.console.log('remote-only');
    assert.equal(pages[0].onHide.call(receiver, 'reason'), 42);
    assert.deepEqual(calls[0], [receiver, ['reason']]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].receiver, host.wx);
    assert.equal(requests[0].options.data.sdkVersion, require('../package.json').version);
    assert.equal(requests[0].options.data.logs[0].type, 'console');
    requests[0].options.success({ statusCode: 200 });
    assert.equal(sdk.network.getRequestList().length, 0);
    sdk.remoteLogger.flush();
    assert.equal(requests.length, 1);
    sdk.destroy();
    assert.equal(host.Page, original.Page);
    assert.equal(timers.size, 0);
    pages[0].onHide.call(receiver, 'after');
    assert.equal(requests.length, 1);
  });

  test(target + ': failed filtering drops data; non-2xx retries are bounded', () => {
    const { sdk, host, requests } = fixture();
    sdk.init({ enabled: true, remoteLogger: {
      url: 'https://example.com/report', reportTypes: ['console'],
      batchSize: 10, maxQueueSize: 2, flushInterval: 0,
      beforeReport(type, data) {
        if (data.content === 'throw') throw new Error('filter failed');
        if (data.content === 'drop') return false;
        return data;
      }
    } });
    host.console.log('throw'); host.console.log('drop');
    sdk.remoteLogger.flush();
    assert.equal(requests.length, 0);
    host.console.log('first'); host.console.log('second');
    sdk.remoteLogger.flush();
    host.console.log('newest');
    requests[0].options.success({ statusCode: 503 });
    sdk.remoteLogger.flush();
    assert.deepEqual(plain(requests[1].options.data.logs.map(item => item.data.content)), ['second', 'newest']);
    requests[1].options.success({ statusCode: 204 });
    sdk.destroy();
  });

  test(target + ': in-flight report callbacks cannot contaminate a new session', () => {
    const { sdk, host, requests } = fixture();
    let oldCallback = 0;
    const options = { enabled: true, remoteLogger: {
      url: 'https://example.com/report', reportTypes: ['console'], batchSize: 1, flushInterval: 0,
      onReportError() { oldCallback++; }
    } };
    sdk.init(options); host.console.log('old');
    sdk.destroy();
    sdk.init(options); host.console.log('new');
    requests[0].options.fail({ errMsg: 'late failure' });
    requests[1].options.success({ statusCode: 200 });
    sdk.remoteLogger.flush();
    assert.equal(requests.length, 2);
    assert.equal(oldCallback, 0);
    sdk.destroy();
  });
}
