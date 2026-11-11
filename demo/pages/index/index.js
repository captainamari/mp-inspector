/**
 * Demo 首页 - 展示 SDK 所有功能
 */
const Inspector = require('../../lib/mp-inspector/core/index');

Page({
  data: {
    requestCount: 0
  },

  onLoad() {
    console.log('[Index] onLoad - 首页加载');

    // 演示：存储一些测试数据到 Storage
    this._initTestStorage();
  },

  onShow() {
    console.log('[Index] onShow - 首页显示');
  },

  // ===== Console 测试 =====

  /**
   * 输出 console.log
   */
  onTestLog() {
    console.log('这是一条普通日志', { name: 'test', value: 123 });
  },

  /**
   * 输出 console.info
   */
  onTestInfo() {
    console.info('这是一条 info 信息', new Date().toLocaleString());
  },

  /**
   * 输出 console.warn
   */
  onTestWarn() {
    console.warn('这是一条 warn 警告', '请注意检查参数');
  },

  /**
   * 输出 console.error
   */
  onTestError() {
    console.error('这是一条 error 错误', { code: 500, msg: 'Internal Error' });
  },

  /**
   * 输出复杂对象
   */
  onTestObject() {
    const complexObj = {
      user: {
        name: '张三',
        age: 28,
        address: {
          city: '深圳',
          district: '南山区'
        }
      },
      orders: [
        { id: 1, product: 'iPhone 15', price: 7999 },
        { id: 2, product: 'MacBook Pro', price: 19999 }
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        source: 'mp-inspector-demo'
      }
    };
    console.log('复杂对象测试:', complexObj);
  },

  /**
   * 触发运行时错误
   */
  onTestRuntimeError() {
    // 故意触发一个运行时错误
    try {
      const obj = null;
      obj.nonExistentMethod();
    } catch (e) {
      // 手动抛出以被 onError 捕获
      throw e;
    }
  },

  /**
   * 触发 Promise 拒绝
   */
  onTestPromiseRejection() {
    new Promise((resolve, reject) => {
      reject('这是一个未处理的 Promise 拒绝');
    });
  },

  // ===== Network 测试 =====

  /**
   * 发送 GET 请求（成功）
   */
  onTestGetRequest() {
    this.setData({ requestCount: this.data.requestCount + 1 });
    console.log('[Network] 发送 GET 请求...');

    wx.request({
      url: 'https://httpbin.org/get',
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'mp-inspector-demo'
      },
      success(res) {
        console.log('[Network] GET 请求成功:', res.statusCode);
      },
      fail(err) {
        console.error('[Network] GET 请求失败:', err.errMsg);
      }
    });
  },

  /**
   * 发送 POST 请求
   */
  onTestPostRequest() {
    this.setData({ requestCount: this.data.requestCount + 1 });
    console.log('[Network] 发送 POST 请求...');

    wx.request({
      url: 'https://httpbin.org/post',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'X-Demo-Mode': 'sample-data'
      },
      data: {
        username: 'demo_user',
        action: 'test_post',
        timestamp: Date.now(),
        payload: {
          items: [1, 2, 3],
          message: '这是一条测试数据'
        }
      },
      success(res) {
        console.log('[Network] POST 请求成功:', res.statusCode);
      },
      fail(err) {
        console.error('[Network] POST 请求失败:', err.errMsg);
      }
    });
  },

  /**
   * 发送一个会失败的请求
   */
  onTestFailRequest() {
    this.setData({ requestCount: this.data.requestCount + 1 });
    console.log('[Network] 发送一个会失败的请求...');

    wx.request({
      url: 'https://httpbin.org/status/500',
      method: 'GET',
      success(res) {
        console.warn('[Network] 请求返回:', res.statusCode);
      },
      fail(err) {
        console.error('[Network] 请求失败:', err.errMsg);
      }
    });
  },

  /**
   * 发送 404 请求
   */
  onTestNotFoundRequest() {
    this.setData({ requestCount: this.data.requestCount + 1 });
    console.log('[Network] 发送 404 请求...');

    wx.request({
      url: 'https://httpbin.org/status/404',
      method: 'GET',
      success(res) {
        console.warn('[Network] 请求返回 404:', res.statusCode);
      },
      fail(err) {
        console.error('[Network] 请求失败:', err.errMsg);
      }
    });
  },

  // ===== Storage 测试 =====

  /**
   * 初始化测试 Storage 数据
   */
  _initTestStorage() {
    wx.setStorageSync('inspector_demo_message', 'This is public sample data');
    wx.setStorageSync('inspector_demo_profile', {
      id: 12345,
      name: '测试用户',
      avatar: 'https://example.com/avatar.jpg',
      role: 'developer'
    });
    wx.setStorageSync('inspector_demo_settings', {
      theme: 'dark',
      language: 'zh-CN',
      notifications: true,
      fontSize: 14
    });
    wx.setStorageSync('inspector_demo_timestamp', Date.now());
    console.log('[Storage] 测试数据已初始化');
  },

  /**
   * 写入新的 Storage 数据
   */
  onTestWriteStorage() {
    const key = 'inspector_demo_' + Date.now();
    const value = { random: Math.random(), time: new Date().toISOString() };
    wx.setStorageSync(key, value);
    console.log('[Storage] 写入数据:', key, value);
    wx.showToast({ title: 'Storage written', icon: 'success' });
  },

  onShowInspector() { Inspector.show(); },
  onHideInspector() { Inspector.hide(); },
  onRestartInspector() {
    Inspector.destroy();
    Inspector.init({ env: 'development' });
    Inspector.show();
    console.log('[Demo] Inspector restarted');
  },

  // ===== 页面导航 =====

  /**
   * 跳转到详情页
   */
  onGoToDetail() {
    wx.navigateTo({
      url: '/pages/detail/detail?id=123&name=demo'
    });
  }
});
