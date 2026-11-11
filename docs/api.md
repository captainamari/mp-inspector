# API

## 初始化

`Inspector.init(options)` 在 `App()` 之前调用。默认不启用；`enabled` 的显式布尔值优先于 `env`。

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| env | 空字符串 | development / dev / test / staging 自动启用；其他值关闭 |
| enabled | 根据 env 判断 | 本地采集与面板总开关；显式配置的远程日志可以独立采集 |
| enableConsole / enableNetwork / enableError / enableStorage | true | 本地各模块开关；Storage 为界面开关 |
| maxLogCount | 500 | 核心日志最大条数；正整数 |
| maxRequestCount | 200 | 核心请求最大条数；正整数 |
| showButton | true | 显示悬浮按钮；false 时可通过组件实例的 showPanel() 展开 |
| buttonPosition | { right: 10, bottom: 200 } | 按钮距右侧、底部的初始像素距离 |
| panelHeight | 60 | 面板占窗口高度百分比 |
| remoteLogger | null | Full 构建可选的远程日志配置 |

界面最多展示最近 200 条日志和 100 条请求；核心队列和界面限制分别生效。
调用 `init()` 之后再修改原选项对象不是受支持的更新方式。

## 生命周期与读取

| 方法 | 行为 |
| --- | --- |
| show({ enableConsole, enableNetwork, enableStorage }) | 显示入口；三个选项只影响标签显示，每次未传的项继承 init 的配置 |
| hide() | 隐藏入口和面板，继续采集和已配置的上报 |
| destroy() | 隐藏、停止采集、清空内存记录、撤销 SDK 钩子并重置配置；远程队列尝试最后一次发送 |
| isEnabled() | 本地 SDK 是否启用；不表示远程上报是否工作 |
| isPanelVisible() | 是否调用了 show 且尚未 hide；不表示用户是否点开了折叠面板 |
| getConfig() / getPanelConfig() | 初始化配置 / 当前标签显示选项 |
| getVersion() | SDK 版本 |
| console.getLogList() / console.clearLogs() | 获取 / 清空核心日志 |
| console.addLog(type, ...args) | 手工加入一条日志 |
| network.getRequestList() / network.clearRequests() | 获取 / 清空请求记录 |
| storage.getAllStorage() / getStorageInfo() | 存储列表 / 平台存储容量概览 |
| storage.getStorageItem(key) / removeStorageItem(key) / clearStorage() | 读取 / 删除 / 清空存储 |
| remoteLogger.supported | Full 为 true，Lite 为 false |
| remoteLogger.flush() | 尝试上报当前队列；Lite 中不执行任何操作 |

读取日志、请求列表用于查看，不应修改返回记录。清空不会取消业务请求。
销毁不会取消已发出的业务或上报请求；业务回调仍然执行，过期上报回调不再操作新实例。
已挂载组件和外部订阅在销毁后仍可跟随再次初始化；组件在 detached 时解绑，外部调用者应自行 `eventBus.off()`。
如果其他库在 SDK 之后也包装全局 API，销毁不会强行覆盖它们。建议明确安装与卸载顺序。

## 远程日志（Full）

```js
Inspector.init({
  enabled: false, // 不开放本地面板
  remoteLogger: {
    url: 'https://example.com/your-report-endpoint', // 替换为自己控制的服务
    reportTypes: ['error', 'network'],
    beforeReport(type, data) {
      // 在此过滤敏感 URL、错误或业务字段；返回 false/null/undefined 丢弃。
      return data;
    }
  }
});
```

这是接口配置示例，不存在内置接收服务。上报接口需要支持 JSON POST，并满足小程序请求域名与 HTTPS 要求。
显式启用 remoteLogger 后，即使 `enabled: false`，也会安装所选类型需要的采集钩子；隐藏面板不是关闭采集。

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| enabled | true（传入有效配置时） | false 可关闭远程模块 |
| url | 无 | 自己控制的接收接口 |
| reportTypes | ['error', 'network'] | 可选 error、network、console |
| batchSize | 20 | 达到此条数触发一次 flush；发送当前队列快照 |
| flushInterval | 30000 | 定时发送间隔（毫秒），0 关闭定时器 |
| maxQueueSize | 200 | 等待队列最多条数；超出丢弃最早记录 |
| timeout | 5000 | 请求超时（毫秒） |
| headers | {} | 自定义请求头 |
| beforeReport(type, data) | 无 | 转换或过滤；抛错时丢弃，不回退到原始数据 |
| onReportSuccess(batch, response) | 无 | 2xx 回调 |
| onReportError(batch, errorOrResponse) | 无 | 网络错误、同步异常或非 2xx 回调 |

请求结构：

```json
{
  "logs": [
    { "type": "error", "data": { "type": "runtime", "message": "Example error", "time": 0 }, "timestamp": 0 }
  ],
  "reportTime": 0,
  "sdkVersion": "1.0.0"
}
```

error 包含类型、错误信息和时间；network 包含 URL、方法、状态码、状态、耗时、错误信息和开始时间，不包含请求体、响应体或请求头；console 包含日志级别、格式化内容和时间。

安装之后注册的 Page 在 onHide/onUnload 时尝试 flush，并继续执行原生命周期回调。定时器、批量阈值和手动 flush 也可触发发送。
失败批次放回有界等待队列，在下次触发时重试。没有持久化、指数退避、次数上限或必达保证；应用退出、网络中断和销毁均可能丢失数据。
SDK 使用初始化前保存的 request 引用发送上报，不将上报请求再次加入自身 Network 队列。
Lite 保留同名空接口，并返回 `supported: false`，不会安装远程采集或生命周期钩子。

## 事件

`eventBus.on(name, handler)`、`once`、`off` 用于高级接入。主要事件为：

| 事件 | 数据 |
| --- | --- |
| sdk:ready / sdk:destroy | 配置 / 无 |
| panel:show / panel:hide | 标签选项 / 无 |
| console:add / console:clear | 日志记录 / 无 |
| network:request / network:response / network:clear | 请求记录 / 请求记录 / 无 |
| storage:change | action 与可选 key |
| remoteLogger:ready / remoteLogger:reported | 无 / count、success、可选 statusCode |

不要在日志相关事件处理器中反复调用被拦截的 console 方法，否则会形成递归。
