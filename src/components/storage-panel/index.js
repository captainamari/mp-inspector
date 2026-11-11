/**
 * StoragePanel - Storage 存储面板组件
 */
const storageManager = require('../../core/storage-manager');
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
    items: [],
    storageInfo: null,
    selectedItem: null,
    showDetail: false
  },

  lifetimes: {
    attached() {
      this._onStorageChange = () => {
        this.refresh();
      };
      eventBus.on('storage:change', this._onStorageChange);
    },

    detached() {
      if (this._onStorageChange) {
        eventBus.off('storage:change', this._onStorageChange);
      }
    }
  },

  observers: {
    'visible': function (val) {
      if (val) {
        this.refresh();
      }
    }
  },

  methods: {
    /**
     * 刷新 Storage 数据
     */
    refresh() {
      const items = storageManager.getAllStorage();
      const info = storageManager.getStorageInfo();
      this.setData({
        items,
        storageInfo: {
          count: info.keys.length,
          currentSize: info.currentSize,
          limitSize: info.limitSize,
          usagePercent: info.limitSize ? ((info.currentSize / info.limitSize) * 100).toFixed(1) : 0
        }
      });
    },

    /**
     * 点击查看详情
     */
    onSelectItem(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.items[index];
      this.setData({
        selectedItem: item,
        showDetail: true
      });
    },

    /**
     * 关闭详情
     */
    onCloseDetail() {
      this.setData({ showDetail: false, selectedItem: null });
    },

    /**
     * 删除单个 Storage 项
     */
    onRemoveItem(e) {
      const key = e.currentTarget.dataset.key;
      wx.showModal({
        title: 'Confirm',
        content: `Delete "${key}"?`,
        success: (res) => {
          if (res.confirm) {
            storageManager.removeStorageItem(key);
            this.refresh();
            if (this.data.selectedItem && this.data.selectedItem.key === key) {
              this.setData({ showDetail: false, selectedItem: null });
            }
          }
        }
      });
    },

    /**
     * 复制值
     */
    onCopyValue(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.items[index] || this.data.selectedItem;
      if (!item) return;
      wx.setClipboardData({
        data: item.valueStr,
        success() {
          wx.showToast({ title: 'Copied', icon: 'success', duration: 1000 });
        }
      });
    }
  }
});
