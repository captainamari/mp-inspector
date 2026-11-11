/**
 * Formatter - 数据格式化工具
 * 处理 JSON 美化展示、HTTP 状态码描述等
 */

/**
 * 安全格式化 JSON
 * @param {*} data
 * @param {number} [indent=2]
 * @returns {string}
 */
function formatJSON(data, indent = 2) {
  if (data === null) return 'null';
  if (data === undefined) return 'undefined';
  if (typeof data === 'string') {
    // 尝试解析为 JSON 对象后格式化
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, replacer, indent);
    } catch (e) {
      return data;
    }
  }
  try {
    return JSON.stringify(data, replacer, indent);
  } catch (e) {
    return String(data);
  }
}

/**
 * JSON.stringify 的 replacer，处理特殊类型
 */
function replacer(key, value) {
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'symbol') return value.toString();
  return value;
}

/**
 * 将对象转为可展示的树形结构
 * @param {*} data
 * @param {number} [maxDepth=5]
 * @param {number} [currentDepth=0]
 * @returns {Array<Object>}
 */
function objectToTree(data, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return [{ key: '...', value: '[Max Depth]', type: 'string', expandable: false }];
  }

  if (data === null || data === undefined) {
    return [{ key: '', value: String(data), type: typeof data, expandable: false }];
  }

  if (typeof data !== 'object') {
    return [{ key: '', value: String(data), type: typeof data, expandable: false }];
  }

  const result = [];
  const seen = new WeakSet();

  if (seen.has(data)) {
    return [{ key: '', value: '[Circular]', type: 'string', expandable: false }];
  }
  seen.add(data);

  const keys = Object.keys(data);
  const isArray = Array.isArray(data);

  keys.forEach(key => {
    const value = data[key];
    const valueType = typeof value;
    const isExpandable = value !== null && valueType === 'object';

    result.push({
      key: isArray ? `[${key}]` : key,
      value: isExpandable
        ? (Array.isArray(value) ? `Array(${value.length})` : `Object{${Object.keys(value).length}}`)
        : formatPrimitive(value),
      type: isExpandable ? (Array.isArray(value) ? 'array' : 'object') : valueType,
      expandable: isExpandable,
      children: isExpandable ? objectToTree(value, maxDepth, currentDepth + 1) : null
    });
  });

  return result;
}

/**
 * 格式化原始类型值
 * @param {*} value
 * @returns {string}
 */
function formatPrimitive(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (typeof value === 'symbol') return value.toString();
  return String(value);
}

/**
 * HTTP 状态码描述
 * @param {number|string} code
 * @returns {string}
 */
function getStatusText(code) {
  const statusMap = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return statusMap[code] || '';
}

/**
 * 获取状态码的分类
 * @param {number|string} code
 * @returns {string} - success | redirect | client-error | server-error | unknown
 */
function getStatusType(code) {
  const num = Number(code);
  if (isNaN(num)) return 'unknown';
  if (num >= 200 && num < 300) return 'success';
  if (num >= 300 && num < 400) return 'redirect';
  if (num >= 400 && num < 500) return 'client-error';
  if (num >= 500) return 'server-error';
  return 'unknown';
}

/**
 * 格式化 Header 对象为可展示的数组
 * @param {Object} headers
 * @returns {Array<{key: string, value: string}>}
 */
function formatHeaders(headers) {
  if (!headers || typeof headers !== 'object') return [];
  return Object.keys(headers).map(key => ({
    key: key,
    value: String(headers[key])
  }));
}

module.exports = {
  formatJSON,
  objectToTree,
  formatPrimitive,
  getStatusText,
  getStatusType,
  formatHeaders
};
