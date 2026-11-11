/**
 * ConsoleInterceptor - Console 拦截器
 * 劫持 console.log / info / warn / error 方法
 * 在保留原始输出的同时，将日志数据推送到 EventBus
 */

const eventBus = require('./event-bus');

const INTERCEPTED_METHODS = ['log', 'info', 'warn', 'error', 'debug'];

// 存储原始 console 方法引用
const originalConsole = {};
const wrappers = {};
const originalDescriptors = {};

// 日志存储队列
let logList = [];
let logId = 0;

// 最大日志条数，防止内存溢出
let maxLogCount = 500;

function configure(limit) {
  maxLogCount = Number.isInteger(limit) && limit > 0 ? limit : 500;
}

/**
 * 序列化日志参数（安全处理循环引用等）
 * @param {*} arg
 * @returns {Object}
 */
function serializeArg(arg) {
  if (arg === null) return { type: 'null', value: 'null' };
  if (arg === undefined) return { type: 'undefined', value: 'undefined' };

  const type = typeof arg;

  if (type === 'string') return { type: 'string', value: arg };
  if (type === 'number') return { type: 'number', value: String(arg) };
  if (type === 'boolean') return { type: 'boolean', value: String(arg) };
  if (type === 'symbol') return { type: 'symbol', value: arg.toString() };
  if (type === 'function') return { type: 'function', value: `ƒ ${arg.name || 'anonymous'}()` };

  if (arg instanceof Error) {
    return {
      type: 'error',
      value: arg.message,
      stack: arg.stack || ''
    };
  }

  if (Array.isArray(arg)) {
    try {
      return { type: 'array', value: safeStringify(arg) };
    } catch (e) {
      return { type: 'array', value: '[Array]' };
    }
  }

  if (type === 'object') {
    try {
      return { type: 'object', value: safeStringify(arg) };
    } catch (e) {
      return { type: 'object', value: '[Object]' };
    }
  }

  return { type: 'unknown', value: String(arg) };
}

/**
 * 安全的 JSON.stringify，处理循环引用
 * @param {*} obj
 * @param {number} [maxDepth=5]
 * @returns {string}
 */
function safeStringify(obj, maxDepth = 5) {
  const seen = new WeakSet();
  return JSON.stringify(obj, function (key, value) {
    if (maxDepth <= 0) return '[Max Depth]';
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
      maxDepth--;
    }
    if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`;
    if (typeof value === 'undefined') return 'undefined';
    if (typeof value === 'symbol') return value.toString();
    return value;
  }, 2);
}

/**
 * 安装 console 拦截
 */
function install() {
  INTERCEPTED_METHODS.forEach(method => {
    if (originalConsole[method]) return; // 避免重复安装
    if (typeof console[method] !== 'function') return;

    originalConsole[method] = console[method];

    // 在 console 上挂载原始方法引用（供内部使用，避免递归）
    const alias = '__original' + method.charAt(0).toUpperCase() + method.slice(1);
    originalDescriptors[alias] = Object.getOwnPropertyDescriptor(console, alias);
    console[alias] = originalConsole[method];
    const original = originalConsole[method];

    wrappers[method] = console[method] = function (...args) {
      // 1. 调用原始方法，保证开发工具中正常输出
      original.apply(console, args);
      if (originalConsole[method] !== original) return;

      // 2. 格式化并存储日志
      const logItem = {
        id: ++logId,
        type: method,
        data: args.map(serializeArg),
        time: Date.now(),
        timeStr: formatTime(Date.now())
      };

      addLog(logItem);
    };
  });
}

/**
 * 卸载 console 拦截，恢复原始方法
 */
function uninstall() {
  INTERCEPTED_METHODS.forEach(method => {
    if (originalConsole[method]) {
      if (console[method] === wrappers[method]) console[method] = originalConsole[method];
      const alias = '__original' + method.charAt(0).toUpperCase() + method.slice(1);
      if (console[alias] === originalConsole[method]) {
        if (originalDescriptors[alias]) Object.defineProperty(console, alias, originalDescriptors[alias]);
        else delete console[alias];
      }
      delete originalConsole[method];
      delete wrappers[method];
      delete originalDescriptors[alias];
    }
  });
}

/**
 * 添加日志到队列
 * @param {Object} logItem
 */
function addLog(logItem) {
  logList.push(logItem);

  // 超过上限时移除最早的日志
  if (logList.length > maxLogCount) {
    logList = logList.slice(-maxLogCount);
  }

  // 通过事件总线通知 UI 更新
  eventBus.emit('console:add', logItem);

  // 供远程日志模块订阅
  eventBus.emit('log:remote', logItem);
}

/**
 * 手动添加一条日志（供错误捕获等模块使用）
 * @param {string} type - log/info/warn/error
 * @param {...*} args - 日志内容
 */
function addManualLog(type, ...args) {
  const logItem = {
    id: ++logId,
    type: type,
    data: args.map(serializeArg),
    time: Date.now(),
    timeStr: formatTime(Date.now())
  };
  addLog(logItem);
}

/**
 * 获取所有日志
 * @returns {Array}
 */
function getLogList() {
  return logList;
}

/**
 * 清空日志
 */
function clearLogs() {
  logList = [];
  logId = 0;
  eventBus.emit('console:clear');
}

/**
 * 格式化时间
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

module.exports = {
  configure,
  install,
  uninstall,
  addManualLog,
  getLogList,
  clearLogs,
  safeStringify,
  serializeArg,
  originalConsole
};
