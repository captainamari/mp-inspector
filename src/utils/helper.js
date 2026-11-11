/**
 * Helper - 辅助工具函数
 */

/**
 * 获取系统信息
 * @returns {Object}
 */
function getSystemInfo() {
  try {
    return wx.getSystemInfoSync();
  } catch (e) {
    return {};
  }
}

/**
 * rpx 转 px
 * @param {number} rpx
 * @returns {number}
 */
function rpx2px(rpx) {
  const sys = getSystemInfo();
  return (rpx / 750) * (sys.windowWidth || 375);
}

/**
 * 格式化时间戳
 * @param {number} timestamp
 * @param {string} [format='HH:mm:ss.SSS']
 * @returns {string}
 */
function formatTime(timestamp, format = 'HH:mm:ss.SSS') {
  const d = new Date(timestamp);
  const map = {
    'HH': String(d.getHours()).padStart(2, '0'),
    'mm': String(d.getMinutes()).padStart(2, '0'),
    'ss': String(d.getSeconds()).padStart(2, '0'),
    'SSS': String(d.getMilliseconds()).padStart(3, '0')
  };
  return format.replace(/HH|mm|ss|SSS/g, match => map[match]);
}

/**
 * 节流函数
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function throttle(fn, delay = 100) {
  let timer = null;
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = null;
        fn.apply(this, args);
      }, delay - (now - lastTime));
    }
  };
}

/**
 * 防抖函数
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
function debounce(fn, delay = 200) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 截断字符串
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 200) {
  if (!str) return '';
  if (typeof str !== 'string') str = String(str);
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + '...';
}

/**
 * 生成唯一 ID
 * @returns {string}
 */
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = {
  getSystemInfo,
  rpx2px,
  formatTime,
  throttle,
  debounce,
  truncate,
  generateUniqueId
};
