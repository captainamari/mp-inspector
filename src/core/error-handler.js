/**
 * ErrorHandler - 全局错误捕获
 * 劫持 App 的 onError 和 onUnhandledRejection
 * 捕获运行时错误并推送到 Console 面板
 */

const eventBus = require('./event-bus');
const consoleInterceptor = require('./console-interceptor');

let installed = false;
let originalAppConstructor = null;
let appWrapper = null;

/**
 * 安装全局错误捕获
 * 注意：此方法必须在 App() 调用之前执行
 */
function install() {
  if (installed) return;
  installed = true;

  if (typeof App === 'undefined') return;

  originalAppConstructor = App;
  const original = App;

  // 重写 App 构造函数
  appWrapper = App = function (config) {
    config = Object.assign({}, config);

    // 劫持 onError
    const originalOnError = config.onError;
    config.onError = function (errMsg) {
      if (installed) handleError(errMsg);
      originalOnError && originalOnError.call(this, errMsg);
    };

    // 劫持 onUnhandledRejection
    const originalOnUnhandledRejection = config.onUnhandledRejection;
    config.onUnhandledRejection = function (res) {
      if (installed) handleUnhandledRejection(res);
      originalOnUnhandledRejection && originalOnUnhandledRejection.call(this, res);
    };

    // 调用原始 App 构造函数
    return original(config);
  };
}

/**
 * 处理运行时错误
 * @param {string} errMsg - 错误信息
 */
function handleError(errMsg) {
  consoleInterceptor.addManualLog('error', '[Runtime Error]', errMsg);
  eventBus.emit('error:runtime', { type: 'runtime', message: errMsg, time: Date.now() });
  // 供远程日志模块订阅
  eventBus.emit('error:remote', { type: 'runtime', message: errMsg, time: Date.now() });
}

/**
 * 处理未捕获的 Promise 拒绝
 * @param {Object} res - { reason, promise }
 */
function handleUnhandledRejection(res) {
  const reason = res && 'reason' in res ? String(res.reason) : 'Unknown rejection';
  consoleInterceptor.addManualLog('error', '[Unhandled Promise Rejection]', reason);
  eventBus.emit('error:promise', { type: 'promise', message: reason, time: Date.now() });
  // 供远程日志模块订阅
  eventBus.emit('error:remote', { type: 'promise', message: reason, time: Date.now() });
}

/**
 * 卸载错误捕获，恢复原始 App 构造函数
 * 注意：由于 App() 只会调用一次，卸载后不会影响已创建的 App 实例
 */
function uninstall() {
  if (originalAppConstructor) {
    if (App === appWrapper) App = originalAppConstructor;
    originalAppConstructor = null;
    appWrapper = null;
  }
  installed = false;
}

module.exports = {
  install,
  uninstall
};
