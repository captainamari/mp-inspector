/**
 * Demo 详情页 - 验证跨页面日志持久化
 */
Page({
  data: {
    id: '',
    name: ''
  },

  onLoad(options) {
    console.log('[Detail] onLoad - 详情页加载', options);
    this.setData({
      id: options.id || '',
      name: options.name || ''
    });

    // 模拟详情页也会发起网络请求
    this._fetchDetail(options.id);
  },

  onShow() {
    console.log('[Detail] onShow');
  },

  /**
   * 模拟获取详情数据
   */
  _fetchDetail(id) {
    console.log('[Detail] 正在获取详情数据, id:', id);

    wx.request({
      url: 'https://httpbin.org/get',
      method: 'GET',
      data: { id: id },
      header: {
        'Content-Type': 'application/json'
      },
      success(res) {
        console.log('[Detail] 详情数据获取成功:', res.statusCode);
      },
      fail(err) {
        console.error('[Detail] 详情数据获取失败:', err.errMsg);
      }
    });
  },

  /**
   * 从详情页输出日志
   */
  onTestDetailLog() {
    console.log('[Detail] 这是从详情页输出的日志', {
      page: 'detail',
      id: this.data.id,
      time: new Date().toISOString()
    });
  },

  /**
   * 返回首页
   */
  onGoBack() {
    wx.navigateBack();
  }
});
