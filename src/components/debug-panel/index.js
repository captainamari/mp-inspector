/**
 * DebugPanel - 主调试面板组件
 * 整合悬浮按钮、Console、Network、Storage 子面板
 *
 * 面板的显示/隐藏由 MpInspector.show() / MpInspector.hide() 控制
 */
const MpInspector = require('../../core/index');
const eventBus = require('../../core/event-bus');

Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true
  },

  properties: {},

  data: {
    // SDK 是否启用（拦截器已安装）
    sdkReady: false,
    // 悬浮按钮和面板是否可见（由 show/hide 控制）
    enabled: false,
    showButton: true,
    buttonPosition: { right: 10, bottom: 200 },
    // 面板是否打开（用户点击悬浮按钮展开）
    panelVisible: false,
    // 当前选中的 Tab
    activeTab: 'console', // console | network | storage
    // Tab 列表（动态，根据 show() 传入的模块开关生成）
    tabs: [],
    // 模块可见性
    showConsole: true,
    showNetwork: true,
    showStorage: true,
    // 未读消息计数
    badgeCount: 0,
    // 面板高度（屏幕百分比 => px）
    panelHeight: 0,
    // 动画控制
    animationClass: ''
  },

  lifetimes: {
    attached() {
      this._bindPanelEvents();

      // 如果 SDK 已就绪，标记 sdkReady
      if (MpInspector.isEnabled()) {
        this._onSdkReady();
      } else {
        // 监听 SDK 异步就绪
        this._sdkReadyHandler = () => {
          this._onSdkReady();
        };
        eventBus.on('sdk:ready', this._sdkReadyHandler);
      }

      // 如果 show() 在组件 attached 之前已经被调用过，直接激活
      if (MpInspector.isPanelVisible()) {
        this._onSdkReady();
        this._showPanel(MpInspector.getPanelConfig());
      }
    },

    detached() {
      clearTimeout(this._hideTimer);
      if (this._onConsoleAdd) eventBus.off('console:add', this._onConsoleAdd);
      if (this._onNetworkRequest) eventBus.off('network:request', this._onNetworkRequest);
      if (this._sdkReadyHandler) eventBus.off('sdk:ready', this._sdkReadyHandler);
      if (this._panelShowHandler) eventBus.off('panel:show', this._panelShowHandler);
      if (this._panelHideHandler) eventBus.off('panel:hide', this._panelHideHandler);
      if (this._destroyHandler) eventBus.off('sdk:destroy', this._destroyHandler);
    }
  },

  methods: {
    /**
     * 绑定面板 show/hide 事件
     */
    _bindPanelEvents() {
      // 监听 MpInspector.show()
      this._panelShowHandler = (modules) => {
        if (!this.data.sdkReady) {
          this._onSdkReady();
        }
        this._showPanel(modules);
      };
      eventBus.on('panel:show', this._panelShowHandler);

      // 监听 MpInspector.hide()
      this._panelHideHandler = () => {
        this._hideAll();
      };
      eventBus.on('panel:hide', this._panelHideHandler);
      this._destroyHandler = () => {
        this._hideAll();
        this.setData({ sdkReady: false });
      };
      eventBus.on('sdk:destroy', this._destroyHandler);
    },

    /**
     * SDK 就绪回调（拦截器已安装）
     */
    _onSdkReady() {
      this.setData({ sdkReady: true });

      // 计算面板高度
      try {
        const sys = wx.getSystemInfoSync();
        const config = MpInspector.getConfig();
        const heightPercent = config.panelHeight || 60;
        this.setData({
          showButton: config.showButton !== false,
          buttonPosition: config.buttonPosition,
          panelHeight: Math.floor(sys.windowHeight * heightPercent / 100)
        });
      } catch (e) {
        this.setData({ panelHeight: 400 });
      }

      // 面板关闭时，新日志/请求增加 badge 计数
      if (!this._onConsoleAdd) {
        this._onConsoleAdd = () => {
          if (this.data.enabled && !this.data.panelVisible) {
            this.setData({ badgeCount: this.data.badgeCount + 1 });
          }
        };
        eventBus.on('console:add', this._onConsoleAdd);
      }

      if (!this._onNetworkRequest) {
        this._onNetworkRequest = () => {
          if (this.data.enabled && !this.data.panelVisible) {
            this.setData({ badgeCount: this.data.badgeCount + 1 });
          }
        };
        eventBus.on('network:request', this._onNetworkRequest);
      }
    },

    /**
     * 显示面板（响应 MpInspector.show()）
     * @param {Object} modules - 模块开关
     */
    _showPanel(modules) {
      modules = modules || {};

      var enableConsole = modules.enableConsole !== false;
      var enableNetwork = modules.enableNetwork !== false;
      var enableStorage = modules.enableStorage !== false;

      // 根据模块开关生成 tabs
      var tabs = [];
      if (enableConsole) tabs.push({ key: 'console', label: 'Console' });
      if (enableNetwork) tabs.push({ key: 'network', label: 'Network' });
      if (enableStorage) tabs.push({ key: 'storage', label: 'Storage' });

      // 如果当前 activeTab 不在新 tabs 中，切换到第一个
      var activeTab = this.data.activeTab;
      var tabKeys = tabs.map(function (t) { return t.key; });
      if (tabKeys.indexOf(activeTab) === -1) {
        activeTab = tabs.length > 0 ? tabs[0].key : 'console';
      }

      this.setData({
        enabled: true,
        tabs: tabs,
        activeTab: activeTab,
        showConsole: enableConsole,
        showNetwork: enableNetwork,
        showStorage: enableStorage
      });
    },

    /**
     * 隐藏所有（响应 MpInspector.hide()）
     */
    _hideAll() {
      clearTimeout(this._hideTimer);
      this.setData({
        enabled: false,
        panelVisible: false,
        animationClass: '',
        badgeCount: 0
      });
    },

    /**
     * 切换面板显示/隐藏（用户点击悬浮按钮）
     */
    onTogglePanel() {
      if (this.data.panelVisible) {
        this.hidePanel();
      } else {
        this.showPanel();
      }
    },

    /**
     * 显示面板（用户展开）
     */
    showPanel() {
      clearTimeout(this._hideTimer);
      this.setData({
        panelVisible: true,
        badgeCount: 0,
        animationClass: 'mp-inspector-panel-slide-in'
      });
    },

    /**
     * 隐藏面板（用户收起）
     */
    hidePanel() {
      this.setData({
        animationClass: 'mp-inspector-panel-slide-out'
      });
      // 动画结束后隐藏
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this.setData({
          panelVisible: false,
          animationClass: ''
        });
      }, 200);
    },

    /**
     * 切换 Tab
     */
    onTabChange(e) {
      const tab = e.currentTarget.dataset.tab;
      this.setData({ activeTab: tab });
    },

    /**
     * 阻止面板内的触摸事件冒泡到页面
     */
    onPreventTouchMove() {
      // 空方法，仅用于 catchtouchmove 阻止冒泡
    }
  }
});
