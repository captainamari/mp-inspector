/**
 * EventBus - 事件总线
 * 用于 SDK 核心模块与 UI 组件之间的跨模块通信
 * 支持 on / off / once / emit
 */

class EventBus {
  constructor() {
    this._events = {};
  }

  /**
   * 注册事件监听
   * @param {string} event - 事件名称
   * @param {Function} handler - 回调函数
   * @returns {EventBus}
   */
  on(event, handler) {
    if (!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(handler);
    return this;
  }

  /**
   * 注册一次性事件监听
   * @param {string} event - 事件名称
   * @param {Function} handler - 回调函数
   * @returns {EventBus}
   */
  once(event, handler) {
    const wrapper = (...args) => {
      handler.apply(this, args);
      this.off(event, wrapper);
    };
    wrapper._original = handler;
    return this.on(event, wrapper);
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   * @param {Function} [handler] - 回调函数，不传则移除该事件所有监听
   * @returns {EventBus}
   */
  off(event, handler) {
    if (!this._events[event]) return this;

    if (!handler) {
      delete this._events[event];
      return this;
    }

    this._events[event] = this._events[event].filter(
      fn => fn !== handler && fn._original !== handler
    );

    if (this._events[event].length === 0) {
      delete this._events[event];
    }

    return this;
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...*} args - 参数
   * @returns {EventBus}
   */
  emit(event, ...args) {
    if (!this._events[event]) return this;

    const handlers = this._events[event].slice();
    handlers.forEach(handler => {
      try {
        handler.apply(this, args);
      } catch (e) {
        console.__originalError
          ? console.__originalError('[MpInspector] EventBus handler error:', e)
          : null;
      }
    });

    return this;
  }

  /**
   * 清除所有事件
   */
  clear() {
    this._events = {};
  }

  /**
   * 获取指定事件的监听器数量
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    return this._events[event] ? this._events[event].length : 0;
  }
}

// 全局单例
const eventBus = new EventBus();

module.exports = eventBus;
