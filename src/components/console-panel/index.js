/**
 * ConsolePanel - Console 日志面板组件
 */
const consoleInterceptor = require('../../core/console-interceptor');
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
    logs: [],
    filterType: 'all', // all | log | info | warn | error
    scrollToView: '',
    filterTypes: [
      { key: 'all', label: 'All' },
      { key: 'log', label: 'Log' },
      { key: 'info', label: 'Info' },
      { key: 'warn', label: 'Warn' },
      { key: 'error', label: 'Error' }
    ]
  },

  lifetimes: {
    attached() {
      // 加载已有日志
      this._loadExistingLogs();

      // 监听新日志
      this._onConsoleAdd = (logItem) => {
        this._addLogToView(logItem);
      };
      eventBus.on('console:add', this._onConsoleAdd);

      // 监听清空
      this._onConsoleClear = () => {
        this.setData({ logs: [], scrollToView: '' });
      };
      eventBus.on('console:clear', this._onConsoleClear);
    },

    detached() {
      if (this._onConsoleAdd) {
        eventBus.off('console:add', this._onConsoleAdd);
      }
      if (this._onConsoleClear) {
        eventBus.off('console:clear', this._onConsoleClear);
      }
    }
  },

  methods: {
    /**
     * 加载已有日志
     */
    _loadExistingLogs() {
      const logList = consoleInterceptor.getLogList();
      const logs = logList.slice(-200).map(item => this._formatLogItem(item));
      this.setData({ logs });
    },

    /**
     * 添加单条日志到视图
     */
    _addLogToView(logItem) {
      const formatted = this._formatLogItem(logItem);
      const logs = this.data.logs.concat([formatted]);
      // 限制视图中的日志条数，避免渲染性能问题
      const maxViewLogs = 200;
      const trimmedLogs = logs.length > maxViewLogs ? logs.slice(-maxViewLogs) : logs;

      this.setData({
        logs: trimmedLogs,
        scrollToView: 'log-' + formatted.id
      });
    },

    /**
     * 格式化日志项为视图数据
     */
    _formatLogItem(item) {
      return {
        id: item.id,
        type: item.type,
        timeStr: item.timeStr,
        // 将 data 数组转为显示字符串
        content: item.data.map(d => {
          if (d.type === 'object' || d.type === 'array') {
            return d.value; // JSON 字符串
          }
          return d.value;
        }).join(' '),
        // 完整数据，点击展开用
        rawData: item.data,
        expanded: false
      };
    },

    /**
     * 切换过滤类型
     */
    onFilterChange(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ filterType: type });
    },

    /**
     * 清空日志
     */
    onClear() {
      consoleInterceptor.clearLogs();
    },

    /**
     * 展开/折叠日志详情
     */
    onToggleExpand(e) {
      const index = this.data.logs.findIndex(log => log.id === Number(e.currentTarget.dataset.id));
      if (index === -1) return;
      const key = `logs[${index}].expanded`;
      this.setData({
        [key]: !this.data.logs[index].expanded
      });
    },

    /**
     * 复制日志内容
     */
    onCopyLog(e) {
      const log = this.data.logs.find(item => item.id === Number(e.currentTarget.dataset.id));
      if (!log) return;
      wx.setClipboardData({
        data: log.content,
        success() {
          wx.showToast({ title: 'Copied', icon: 'success', duration: 1000 });
        }
      });
    },

    /**
     * 获取当前过滤后的日志（在 wxml 中通过 wxs 过滤，此处提供备用）
     */
    getFilteredLogs() {
      if (this.data.filterType === 'all') return this.data.logs;
      return this.data.logs.filter(log => log.type === this.data.filterType);
    }
  }
});
