/** Optional, bounded, in-memory reporting. No endpoint is enabled by default. */
const eventBus = require('./event-bus');
const version = require('./version');
let state = null;

function positive(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function install(options, originalRequest) {
  if (state || !options || !options.enabled || !options.url) return;
  if (typeof originalRequest !== 'function') return;
  const config = Object.assign({
    reportTypes: ['error', 'network'], batchSize: 20, flushInterval: 30000,
    maxQueueSize: 200, headers: {}, timeout: 5000
  }, options);
  config.batchSize = positive(config.batchSize, 20);
  config.maxQueueSize = positive(config.maxQueueSize, 200);
  const current = state = {
    config, request: originalRequest, queue: [], flushing: false, listeners: [],
    timer: null, originalPage: null, pageWrapper: null
  };

  const sources = {
    error: ['error:remote', data => data],
    network: ['network:remote', record => ({
      url: record.url, method: record.method, statusCode: record.statusCode,
      duration: record.duration, status: record.status, errMsg: record.errMsg || '',
      startTimeStr: record.startTimeStr
    })],
    console: ['log:remote', item => ({
      type: item.type, content: item.data.map(d => d.value).join(' '), timeStr: item.timeStr
    })]
  };
  Object.keys(sources).forEach(type => {
    if (config.reportTypes.indexOf(type) === -1) return;
    const [event, transform] = sources[type];
    const handler = data => enqueue(current, type, transform(data));
    eventBus.on(event, handler);
    current.listeners.push([event, handler]);
  });
  if (config.flushInterval > 0) current.timer = setInterval(flush, config.flushInterval);
  if (typeof Page !== 'undefined') {
    const original = current.originalPage = Page;
    current.pageWrapper = Page = function (definition) {
      const wrapped = Object.assign({}, definition);
      ['onHide', 'onUnload'].forEach(key => {
        const callback = wrapped[key];
        wrapped[key] = function (...args) {
          flush();
          if (typeof callback === 'function') return callback.apply(this, args);
        };
      });
      return original(wrapped);
    };
  }
  eventBus.emit('remoteLogger:ready');
}

function enqueue(current, type, data) {
  if (state !== current) return;
  if (typeof current.config.beforeReport === 'function') {
    try { data = current.config.beforeReport(type, data); }
    catch (error) { return; } // Failed filtering must not send the unfiltered payload.
    if (data === false || data === null || data === undefined) return;
  }
  current.queue.push({ type, data, timestamp: Date.now() });
  current.queue = current.queue.slice(-current.config.maxQueueSize);
  if (current.queue.length >= current.config.batchSize) flush();
}

function flush() {
  const current = state;
  if (!current || current.flushing || !current.queue.length) return;
  const { config } = current;
  const batch = current.queue.splice(0);
  current.flushing = true;
  let completed = false;
  function finish(success, response) {
    if (completed) return;
    completed = true;
    // Requests from a destroyed instance cannot modify a newly initialized queue.
    if (state !== current) return;
    current.flushing = false;
    if (!success) current.queue = batch.concat(current.queue).slice(-config.maxQueueSize);
    eventBus.emit('remoteLogger:reported', { count: batch.length, success, statusCode: response && response.statusCode });
    const callback = success ? config.onReportSuccess : config.onReportError;
    if (typeof callback === 'function') {
      try { callback(batch, response); } catch (error) { /* Reporting callbacks are isolated. */ }
    }
  }
  try {
    current.request.call(wx, {
      url: config.url, method: 'POST',
      header: Object.assign({ 'content-type': 'application/json' }, config.headers),
      timeout: config.timeout,
      data: { logs: batch, reportTime: Date.now(), sdkVersion: version },
      success: response => finish(response.statusCode >= 200 && response.statusCode < 300, response),
      fail: error => finish(false, error)
    });
  } catch (error) { finish(false, error); }
}

function uninstall() {
  const current = state;
  if (!current) return;
  // Best-effort final send; there is no durable queue or delivery guarantee.
  flush();
  state = null;
  current.listeners.forEach(([event, handler]) => eventBus.off(event, handler));
  if (current.timer !== null) clearInterval(current.timer);
  if (current.originalPage && Page === current.pageWrapper) Page = current.originalPage;
  current.queue = [];
}

module.exports = { supported: true, install, uninstall, flush };
