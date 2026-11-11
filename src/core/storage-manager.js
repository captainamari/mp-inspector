/**
 * StorageManager - Storage 存储管理
 * 读取、展示小程序本地存储数据
 */

const eventBus = require('./event-bus');

/**
 * 安全的 JSON.stringify
 * @param {*} value
 * @returns {string}
 */
function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

/**
 * 获取值的类型描述
 * @param {*} value
 * @returns {string}
 */
function getValueType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * 获取所有 Storage 数据
 * @returns {Array<Object>}
 */
function getAllStorage() {
  try {
    const info = wx.getStorageInfoSync();
    const keys = info.keys || [];
    const items = [];

    keys.forEach(key => {
      try {
        const value = wx.getStorageSync(key);
        const valueStr = safeStringify(value);
        items.push({
          key: key,
          value: value,
          valueStr: valueStr,
          valueType: getValueType(value),
          size: valueStr.length
        });
      } catch (e) {
        items.push({
          key: key,
          value: '[Read Error]',
          valueStr: '[Read Error]',
          valueType: 'error',
          size: 0
        });
      }
    });

    return items;
  } catch (e) {
    return [];
  }
}

/**
 * 获取 Storage 概览信息
 * @returns {Object}
 */
function getStorageInfo() {
  try {
    const info = wx.getStorageInfoSync();
    return {
      keys: info.keys || [],
      currentSize: info.currentSize || 0, // KB
      limitSize: info.limitSize || 0       // KB
    };
  } catch (e) {
    return { keys: [], currentSize: 0, limitSize: 0 };
  }
}

/**
 * 获取单个 Storage 值
 * @param {string} key
 * @returns {*}
 */
function getStorageItem(key) {
  try {
    return wx.getStorageSync(key);
  } catch (e) {
    return undefined;
  }
}

/**
 * 删除单个 Storage 项
 * @param {string} key
 */
function removeStorageItem(key) {
  try {
    wx.removeStorageSync(key);
    eventBus.emit('storage:change', { action: 'remove', key });
  } catch (e) {
    // ignore
  }
}

/**
 * 清空所有 Storage
 */
function clearStorage() {
  try {
    wx.clearStorageSync();
    eventBus.emit('storage:change', { action: 'clear' });
  } catch (e) {
    // ignore
  }
}

module.exports = {
  getAllStorage,
  getStorageInfo,
  getStorageItem,
  removeStorageItem,
  clearStorage
};
