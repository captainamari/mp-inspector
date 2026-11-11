/**
 * NetworkPanel - 网络请求面板组件
 */
const networkInterceptor = require('../../core/network-interceptor');
const eventBus = require('../../core/event-bus');

Component({
  options: {
    addGlobalClass: true
  },

  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    requests: [],
    selectedRequest: null,
    showDetail: false,
    detailTab: 'general', // general | requestHeaders | requestBody | response
    scrollToView: '',
    detailTabs: [
      { key: 'general', label: 'General' },
      { key: 'reqHeaders', label: 'Req Headers' },
      { key: 'reqBody', label: 'Req Body' },
      { key: 'response', label: 'Response' }
    ]
  },

  lifetimes: {
    attached() {
      // 加载已有请求
      this._loadExistingRequests();

      // 监听新请求
      this._onNetworkRequest = (record) => {
        this._addRequestToView(record);
      };
      eventBus.on('network:request', this._onNetworkRequest);

      // 监听请求响应
      this._onNetworkResponse = (record) => {
        this._updateRequestInView(record);
      };
      eventBus.on('network:response', this._onNetworkResponse);

      // 监听清空
      this._onNetworkClear = () => {
        this.setData({ requests: [], selectedRequest: null, showDetail: false });
      };
      eventBus.on('network:clear', this._onNetworkClear);
    },

    detached() {
      if (this._onNetworkRequest) eventBus.off('network:request', this._onNetworkRequest);
      if (this._onNetworkResponse) eventBus.off('network:response', this._onNetworkResponse);
      if (this._onNetworkClear) eventBus.off('network:clear', this._onNetworkClear);
    }
  },

  methods: {
    /**
     * 加载已有请求记录
     */
    _loadExistingRequests() {
      const list = networkInterceptor.getRequestList();
      const requests = list.slice(-100).map(item => this._formatRequestItem(item));
      this.setData({ requests });
    },

    /**
     * 添加新请求到视图
     */
    _addRequestToView(record) {
      const formatted = this._formatRequestItem(record);
      const requests = this.data.requests.concat([formatted]);
      const maxViewRequests = 100;
      const trimmed = requests.length > maxViewRequests ? requests.slice(-maxViewRequests) : requests;

      this.setData({
        requests: trimmed,
        scrollToView: 'req-' + formatted.id
      });
    },

    /**
     * 更新请求记录（收到响应时）
     */
    _updateRequestInView(record) {
      const index = this.data.requests.findIndex(r => r.id === record.id);
      if (index === -1) return;

      const formatted = this._formatRequestItem(record);
      const key = `requests[${index}]`;
      const updateData = { [key]: formatted };

      // 如果当前正在查看这条请求的详情，也需要更新
      if (this.data.selectedRequest && this.data.selectedRequest.id === record.id) {
        updateData.selectedRequest = formatted;
      }

      this.setData(updateData);
    },

    /**
     * 格式化请求项为视图数据
     */
    _formatRequestItem(item) {
      return {
        id: item.id,
        url: item.url,
        shortUrl: item.shortUrl,
        method: item.method,
        statusCode: item.statusCode,
        statusType: this._getStatusType(item.statusCode),
        durationStr: item.durationStr || '',
        startTimeStr: item.startTimeStr,
        status: item.status,
        responseSize: item.responseSize || '',
        // 详情数据
        requestHeader: item.requestHeader || {},
        requestHeaderList: this._objectToList(item.requestHeader),
        requestData: item.requestData,
        requestDataFormatted: item.requestDataFormatted || '',
        responseHeader: item.responseHeader || {},
        responseHeaderList: this._objectToList(item.responseHeader),
        responseData: item.responseData,
        responseDataFormatted: item.responseDataFormatted || '',
        errMsg: item.errMsg || ''
      };
    },

    /**
     * 获取状态码类型
     */
    _getStatusType(code) {
      const num = Number(code);
      if (isNaN(num)) return code === 'Pending' ? 'pending' : 'fail';
      if (num >= 200 && num < 300) return 'success';
      if (num >= 300 && num < 400) return 'redirect';
      if (num >= 400 && num < 500) return 'client-error';
      if (num >= 500) return 'server-error';
      return 'unknown';
    },

    /**
     * 对象转列表
     */
    _objectToList(obj) {
      if (!obj || typeof obj !== 'object') return [];
      return Object.keys(obj).map(key => ({ key, value: String(obj[key]) }));
    },

    /**
     * 点击请求条目，查看详情
     */
    onSelectRequest(e) {
      const index = e.currentTarget.dataset.index;
      const request = this.data.requests[index];
      this.setData({
        selectedRequest: request,
        showDetail: true,
        detailTab: 'general'
      });
    },

    /**
     * 关闭详情
     */
    onCloseDetail() {
      this.setData({ showDetail: false, selectedRequest: null });
    },

    /**
     * 切换详情 Tab
     */
    onDetailTabChange(e) {
      const tab = e.currentTarget.dataset.tab;
      this.setData({ detailTab: tab });
    },

    /**
     * 清空请求记录
     */
    onClear() {
      networkInterceptor.clearRequests();
    },

    /**
     * 复制请求信息
     */
    onCopyRequest() {
      const req = this.data.selectedRequest;
      if (!req) return;

      const info = [
        `URL: ${req.url}`,
        `Method: ${req.method}`,
        `Status: ${req.statusCode}`,
        `Duration: ${req.durationStr}`,
        `\nRequest Headers:\n${JSON.stringify(req.requestHeader, null, 2)}`,
        `\nRequest Body:\n${req.requestDataFormatted || '(empty)'}`,
        `\nResponse:\n${req.responseDataFormatted || '(empty)'}`
      ].join('\n');

      wx.setClipboardData({
        data: info,
        success() {
          wx.showToast({ title: 'Copied', icon: 'success', duration: 1000 });
        }
      });
    }
  }
});
