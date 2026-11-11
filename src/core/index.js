/** MP Inspector: install capture before App(), then show/hide the panel explicitly. */
const eventBus = require('./event-bus');
const consoleInterceptor = require('./console-interceptor');
const networkInterceptor = require('./network-interceptor');
const errorHandler = require('./error-handler');
const storageManager = require('./storage-manager');
const remoteLogger = require('./remote-logger');
const version = require('./version');

function defaults() {
  return {
    env: '', enabled: undefined,
    maxLogCount: 500, maxRequestCount: 200,
    showButton: true, buttonPosition: { right: 10, bottom: 200 }, panelHeight: 60,
    enableConsole: true, enableNetwork: true, enableError: true, enableStorage: true,
    remoteLogger: null
  };
}

let config = defaults();
let initialized = false;
let panelVisible = false;
let panelModules = {};

function init(options) {
  if (initialized) return;
  config = Object.assign(defaults(), options || {});
  config.buttonPosition = Object.assign(defaults().buttonPosition, config.buttonPosition);
  if (typeof config.enabled !== 'boolean') {
    config.enabled = ['development', 'dev', 'test', 'staging'].indexOf(String(config.env).toLowerCase()) !== -1;
  }
  panelModules = {
    enableConsole: config.enableConsole !== false,
    enableNetwork: config.enableNetwork !== false,
    enableStorage: config.enableStorage !== false
  };

  const report = config.remoteLogger;
  const reporting = remoteLogger.supported !== false && report && report.url && report.enabled !== false;
  const types = reporting ? (report.reportTypes || ['error', 'network']) : [];
  const request = typeof wx !== 'undefined' ? wx.request : null;
  consoleInterceptor.configure(config.maxLogCount);
  networkInterceptor.configure(config.maxRequestCount);
  // Remote reporting may collect while the local panel is disabled; it is explicit opt-in.
  if ((config.enabled && config.enableError) || types.indexOf('error') !== -1) errorHandler.install();
  if ((config.enabled && config.enableConsole) || types.indexOf('console') !== -1) consoleInterceptor.install();
  if ((config.enabled && config.enableNetwork) || types.indexOf('network') !== -1) networkInterceptor.install();
  if (reporting) remoteLogger.install(Object.assign({ enabled: true }, report), request);
  initialized = true;
  if (config.enabled) eventBus.emit('sdk:ready', getConfig());
}

/** Module switches here affect visibility only; init() controls capture. */
function show(options) {
  if (!initialized || !config.enabled) return;
  panelModules = {
    enableConsole: config.enableConsole !== false,
    enableNetwork: config.enableNetwork !== false,
    enableStorage: config.enableStorage !== false
  };
  ['enableConsole', 'enableNetwork', 'enableStorage'].forEach(key => {
    if (options && typeof options[key] === 'boolean') panelModules[key] = options[key];
  });
  panelVisible = true;
  eventBus.emit('panel:show', getPanelConfig());
}

function hide() {
  if (!initialized) return;
  panelVisible = false;
  eventBus.emit('panel:hide');
}

function destroy() {
  if (!initialized) return;
  hide();
  remoteLogger.uninstall();
  consoleInterceptor.uninstall();
  networkInterceptor.uninstall();
  errorHandler.uninstall();
  consoleInterceptor.clearLogs();
  networkInterceptor.clearRequests();
  initialized = false;
  config = defaults();
  panelModules = {};
  // Components/consumers own their subscriptions and remove them on detach/off.
  eventBus.emit('sdk:destroy');
}

function getConfig() {
  return Object.assign({}, config, { buttonPosition: Object.assign({}, config.buttonPosition) });
}

function getPanelConfig() { return Object.assign({}, panelModules); }

module.exports = {
  init, show, hide, destroy,
  isEnabled: () => initialized && config.enabled === true,
  isPanelVisible: () => panelVisible,
  getConfig, getPanelConfig, getVersion: () => version,
  eventBus,
  console: {
    getLogList: consoleInterceptor.getLogList,
    clearLogs: consoleInterceptor.clearLogs,
    addLog: consoleInterceptor.addManualLog
  },
  network: {
    getRequestList: networkInterceptor.getRequestList,
    clearRequests: networkInterceptor.clearRequests
  },
  storage: storageManager,
  remoteLogger: { supported: remoteLogger.supported !== false, flush: remoteLogger.flush }
};
