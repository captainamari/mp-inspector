# MP Inspector

微信小程序调试面板。在小程序页面内查看 Console 日志、网络请求、错误和本地 Storage，方便开发与测试人员排查问题。

A debugging panel for WeChat Mini Programs with zero runtime dependencies.

## 功能

- **Console**：记录 log、info、warn、error、debug，支持筛选、展开和复制；循环引用可序列化。
- **Network**：记录 `wx.request` 的请求头、请求体、响应和耗时，保留原请求任务与业务回调。
- **Error**：捕获 App 的运行时错误和未处理 Promise 拒绝。
- **Storage**：查看、复制、删除单项；另提供清空存储 API。
- **显示控制**：通过 `show()` / `hide()` 控制入口和面板，通过选项控制显示哪些模块。
- **远程日志（Full）**：可选的内存队列、批量上报和过滤钩子；默认没有上报地址，也不会自动连接任何服务。

| 构建 | 本地调试面板 | 远程日志 | 输出目录 |
| --- | --- | --- | --- |
| Full | 支持 | 支持，需显式配置 | `dist/mp-inspector/` |
| Lite | 支持 | 不支持 | `dist/mp-inspector-lite/` |

两种构建使用同一份源码。零运行时依赖指接入小程序后不需要第三方运行库；构建使用 Node.js、Terser 和 Clean CSS。

## 快速开始

构建环境：Node.js 22 或更高版本。以下命令在仓库根目录执行：

```sh
npm ci
npm run build
```

将 `dist/mp-inspector/` 整个目录复制到小程序源码根目录的 `lib/mp-inspector/`。选择 Lite 时，也将 `dist/mp-inspector-lite/` 复制到这个路径，接入代码相同。

**1. 在 app.js 中，在 App() 之前初始化。**

```js
const Inspector = require('./lib/mp-inspector/core/index');

Inspector.init({ env: 'development' });
Inspector.show();

App({
  onLaunch() {
    console.log('Inspector ready', Inspector.getVersion());
  }
});
```

**2. 在 app.json 注册组件。**

```json
{
  "usingComponents": {
    "mp-inspector": "/lib/mp-inspector/components/debug-panel/index"
  }
}
```

**3. 在需要调试入口的页面 WXML 中加入组件。**

```xml
<mp-inspector />
```

点击悬浮按钮展开面板。组件需要放在页面中；只注册组件不会自动向所有页面插入入口。

## 运行示例

```sh
npm run demo:sync
```

用微信开发者工具导入 `demo/`，填写你自己的 AppID 或使用工具提供的测试模式。详见 [示例说明](https://github.com/captainamari/mp-inspector/tree/main/demo)。

`demo/lib/` 由命令生成，不维护第二份 SDK。检查压缩产物时可执行：

```sh
npm run build
npm run demo:sync -- full
# 或 npm run demo:sync -- lite
```

## 常用控制

```js
Inspector.show({ enableStorage: false }); // 隐藏 Storage 标签
Inspector.hide();                        // 隐藏入口和面板，采集继续
Inspector.destroy();                     // 停止采集，清理记录，恢复自身安装的钩子
```

`init()` 的重复调用会被忽略；修改采集配置需要先 `destroy()` 再 `init()`。
`show()` 的模块选项只影响显示，不修改初始化时的采集开关。
应用自行决定哪些用户可以看到面板；SDK 不包含登录、账号识别或权限服务。

完整选项、远程上报格式和生命周期语义见 [API 文档](docs/api.md)。

## 使用边界

- 面向原生微信小程序。uni-app、Taro、其他平台和自定义渲染器尚未做适配验证。
- Network 当前只拦截 `wx.request`，不包含上传、下载、WebSocket 和云调用。HTTP 4xx/5xx 保留平台回调语义，不会被改成网络失败回调。
- `hide()` 只隐藏界面。生产环境是否采集、是否上报，应由应用明确配置；没有内置授权判断。
- 本地面板会展示原始调试数据，Storage 也包含删除操作。远程上报由应用提供接口、域名配置和过滤规则；`beforeReport` 抛错时丢弃该条数据。
- 日志和请求按条数限量保存，单条体积没有硬上限。大响应、高频日志可能增加内存和渲染负担，应在自己的设备与业务流量下验证。
- 自动化测试覆盖模拟宿主下的生命周期、回调、组件状态和构建契约；不能代替微信开发者工具与 iOS/Android 真机验收。见 [验证清单](docs/testing.md)。

## 开发与打包

```sh
npm run check    # 构建 Full/Lite、运行测试、同步源码到 demo
npm run package  # 完整检查后生成 artifacts/*.tgz 和 SHA256SUMS
```

构建会输出实际 SDK 文件字节数，记录于 `dist/build-report.json`，不使用未经测量的包体积承诺。
压缩包中包含 SDK、许可证和文档，解压后将 `package/` 重命名为 `mp-inspector/` 即可按上面的方式接入。

CI 会检查源码与两种构建，并上传两个安装包及示例包。尚未发布到 npm；这里的安装方式不依赖同名 npm 包。

- [架构与维护入口](docs/architecture.md)
- [贡献说明](CONTRIBUTING.md)
- [更新记录](CHANGELOG.md)
- [问题反馈](https://github.com/captainamari/mp-inspector/issues)

## License

[MIT](LICENSE) © captainamari
