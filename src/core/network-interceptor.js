/**
 * NetworkInterceptor - 网络请求拦截器
 * 代理 wx.request，捕获请求头、请求体、响应报文、请求URL等
 */

const eventBus = require('./event-bus');

// 存储原始 wx.request 引用
let originalRequest = null;
let originalDescriptor = null;
let requestWrapper = null;
let generation = 0;

// 请求记录列表
let requestList = [];
let requestId = 0;

// 最大记录条数
let maxRequestCount = 200;

function configure(limit) {
  maxRequestCount = Number.isInteger(limit) && limit > 0 ? limit : 200;
}

/**
 * 生成唯一请求 ID
 * @returns {number}
 */
function generateId() {
  return ++requestId;
}

/**
 * 格式化请求数据（安全处理）
 * @param {*} data
 * @returns {string}
 */
function formatData(data) {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
}

/**
 * 获取数据大小的可读字符串
 * @param {*} data
 * @returns {string}
 */
function getDataSize(data) {
  let size = 0;
  if (typeof data === 'string') {
    size = data.length;
  } else if (data) {
    try {
      size = JSON.stringify(data).length;
    } catch (e) {
      size = 0;
    }
  }

  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / 1024 / 1024).toFixed(1) + ' MB';
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

/**
 * 从 URL 中提取短路径（用于列表显示）
 * @param {string} url
 * @returns {string}
 */
function getShortUrl(url) {
  if (!url) return '';
  try {
    // 移除协议和域名，只保留路径
    const match = url.match(/^https?:\/\/[^/]+(\/.*)/);
    if (match) return match[1];
    return url;
  } catch (e) {
    return url;
  }
}

/**
 * 安装网络请求拦截
 */
function install() {
  if (originalRequest) return; // 避免重复安装

  if (typeof wx === 'undefined' || !wx.request) {
    console.__originalWarn && console.__originalWarn('[MpInspector] wx.request not found, network interceptor skipped');
    return;
  }

  originalRequest = wx.request;
  originalDescriptor = Object.getOwnPropertyDescriptor(wx, 'request');
  const request = originalRequest;
  const session = ++generation;

  // 将 wx.request 设为可写
  try {
    Object.defineProperty(wx, 'request', {
      writable: true,
      configurable: true
    });
  } catch (e) {
    // 某些环境下 defineProperty 可能失败，尝试直接赋值
  }

  requestWrapper = function (options) {
    // Do not mutate caller-owned options or wrap reused callbacks repeatedly.
    options = Object.assign({}, options);
    const id = generateId();
    const startTime = Date.now();

    // 构建请求记录
    const record = {
      id: id,
      url: options.url || '',
      shortUrl: getShortUrl(options.url),
      method: (options.method || 'GET').toUpperCase(),
      requestHeader: options.header || {},
      requestData: options.data,
      requestDataFormatted: formatData(options.data),
      startTime: startTime,
      startTimeStr: formatTime(startTime),
      // 以下字段在响应后填充
      statusCode: 'Pending',
      responseHeader: null,
      responseData: null,
      responseDataFormatted: '',
      responseSize: '',
      duration: 0,
      durationStr: '',
      status: 'pending', // pending | success | fail
      errMsg: ''
    };

    // 添加到列表
    addRequest(record);

    // 劫持 success 回调
    const originalSuccess = options.success;
    options.success = function (res) {
      if (session === generation) updateRequest(id, {
        statusCode: res.statusCode,
        responseHeader: res.header || {},
        responseData: res.data,
        responseDataFormatted: formatData(res.data),
        responseSize: getDataSize(res.data),
        duration: Date.now() - startTime,
        durationStr: (Date.now() - startTime) + 'ms',
        status: 'success'
      });

      originalSuccess && originalSuccess.call(this, res);
    };

    // 劫持 fail 回调
    const originalFail = options.fail;
    options.fail = function (res) {
      if (session === generation) updateRequest(id, {
        statusCode: 'Fail',
        duration: Date.now() - startTime,
        durationStr: (Date.now() - startTime) + 'ms',
        status: 'fail',
        errMsg: res.errMsg || 'Request failed'
      });

      originalFail && originalFail.call(this, res);
    };

    // 劫持 complete 回调
    const originalComplete = options.complete;
    options.complete = function (res) {
      // 如果 success/fail 没有触发更新（理论上不会），在 complete 中兜底
      const existing = requestList.find(r => r.id === id);
      if (session === generation && existing && existing.status === 'pending') {
        updateRequest(id, {
          statusCode: res.statusCode || 'Unknown',
          duration: Date.now() - startTime,
          durationStr: (Date.now() - startTime) + 'ms',
          status: res.statusCode ? 'success' : 'fail'
        });
      }

      originalComplete && originalComplete.call(this, res);
    };

    // 调用原始 wx.request
    return request.call(this, options);
  };
  try {
    wx.request = requestWrapper;
  } catch (e) { /* A host may expose a read-only request method. */ }
  if (wx.request !== requestWrapper) {
    originalRequest = null;
    requestWrapper = null;
  }
}

/**
 * 卸载网络请求拦截，恢复原始 wx.request
 */
function uninstall() {
  generation++;
  if (originalRequest) {
    if (wx.request === requestWrapper) {
      if (originalDescriptor) Object.defineProperty(wx, 'request', originalDescriptor);
      else delete wx.request;
    }
    originalRequest = null;
    requestWrapper = null;
    originalDescriptor = null;
  }
}

/**
 * 添加请求记录
 * @param {Object} record
 */
function addRequest(record) {
  requestList.push(record);

  // 超过上限时移除最早的记录
  if (requestList.length > maxRequestCount) {
    requestList = requestList.slice(-maxRequestCount);
  }

  eventBus.emit('network:request', record);
}

/**
 * 更新请求记录（收到响应时）
 * @param {number} id - 请求 ID
 * @param {Object} data - 更新数据
 */
function updateRequest(id, data) {
  const record = requestList.find(r => r.id === id);
  if (record) {
    Object.assign(record, data);
    eventBus.emit('network:response', record);

    // 供远程日志模块订阅
    eventBus.emit('network:remote', record);
  }
}

/**
 * 获取所有请求记录
 * @returns {Array}
 */
function getRequestList() {
  return requestList;
}

/**
 * 清空请求记录
 */
function clearRequests() {
  requestList = [];
  eventBus.emit('network:clear');
}

module.exports = {
  configure,
  install,
  uninstall,
  getRequestList,
  clearRequests
};
